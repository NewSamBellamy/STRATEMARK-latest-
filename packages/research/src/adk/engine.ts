/**
 * Living Deck Engine — the ADK multi-agent orchestrator.
 *
 * This is the composition root. It wires the three subagents into one DAG,
 * owns the deck's reduced state, and turns the whole run into a single
 * observable stream:
 *
 *     discovery (parallel, 3 vectors)
 *          └─> enrichment (parallel pool, streaming)
 *                   └─> watcher (loop, non-critical)
 *
 * Two properties drive the design.
 *
 * **Fast boot.** The user should see deck structure in seconds, not after the
 * whole research run finishes. Discovery is therefore a hard gate that returns
 * a thin topology, and `bootMs` measures exactly that moment — the engine
 * reports it separately from total runtime so a boot-time regression is visible
 * rather than buried in a single duration number.
 *
 * **Degradation over failure.** Only discovery is critical. If enrichment
 * partially fails the deck still renders with the cards that landed, and if the
 * watcher fails the deck is simply not growing — neither is an error state. The
 * graph encodes that policy in the `critical` flags rather than in scattered
 * try/catch blocks.
 *
 * Note on ADK: this scaffold implements ADK's *composition semantics* —
 * sequential/parallel/loop agents, `output_key` state chaining, and the event
 * grammar with `state_delta` and `escalate` — natively, with no runtime
 * dependency added. `@mi/research` is deliberately dependency-free apart from
 * zod, and the boundary here is shaped so an ADK runner can be swapped in
 * behind `runAdkTaskGraph` without touching the agents or the contracts.
 */
import {
  adkAgentGraphSchema,
  applyLivingDeckDelta,
  createLivingDeckState,
  upsertNodeStatus,
  type AdkAgentGraph,
  type AdkTraceEvent,
  type AdkTraceSink,
  type AdkTraceSummary,
  type CardWithCompany,
  type LivingDeckDelta,
  type LivingDeckNodeStatus,
  type LivingDeckState,
} from '@mi/contracts';
import { createRateLimiter, type RateLimiter } from '../util';
import type { LlmClient, MarketPlan } from '../types';
import type { HydrateCompanyCardResult } from '../company-agent';
import { AdkTelemetryHub, createAdkTelemetry } from './telemetry';
import { AdkSession, runAdkTaskGraph, type AdkTaskNode } from './task-graph';
import {
  DISCOVERY_NODE_ID,
  TOPOLOGY_STATE_KEY,
  createDiscoveryNode,
  isMarketTopology,
  type MarketTopology,
} from './discovery-agent';
import {
  ENRICHMENT_NODE_ID,
  ENRICHMENT_STATE_KEY,
  createEnrichmentNode,
  isEnrichmentPoolResult,
  type EnrichmentFailure,
} from './enrichment-pool';
import {
  WATCHER_NODE_ID,
  WATCHER_STATE_KEY,
  createWatcherNode,
  isSignalWatchResult,
  type SignalWatchResult,
} from './delta-agent';

// ============================================================================
// 1. Events
// ============================================================================

export type LivingDeckEngineEvent =
  | { type: 'boot'; topology: MarketTopology; elapsedMs: number }
  | { type: 'card'; result: HydrateCompanyCardResult }
  | { type: 'growth'; card: CardWithCompany }
  | { type: 'delta'; delta: LivingDeckDelta }
  | { type: 'node'; status: LivingDeckNodeStatus }
  | { type: 'done'; state: LivingDeckState };

export type OnLivingDeckEvent = (event: LivingDeckEngineEvent) => void;

// ============================================================================
// 2. Options + result
// ============================================================================

export interface LivingDeckEngineOptions {
  client: LlmClient;
  plan: MarketPlan;
  deckId: string;
  telemetry?: AdkTelemetryHub;
  signal?: AbortSignal;
  /** Nodes in flight in the top-level DAG. Defaults to 2. */
  graphConcurrency?: number;
  /** Hydration workers. Defaults to 3. */
  enrichmentConcurrency?: number;
  /** Cap on candidates hydrated in the first pass. */
  maxCandidates?: number;
  /** Per-vector discovery targets. */
  discoveryTargets?: Parameters<typeof createDiscoveryNode>[0]['targets'];
  /** Enable the growth loop. Defaults to true. */
  watch?: boolean;
  watchIterations?: number;
  /** Proactive pacing, in requests per minute. Omit to disable. */
  requestsPerMinute?: number;
  rateLimiter?: RateLimiter;
  onEvent?: OnLivingDeckEvent;
  onTrace?: AdkTraceSink;
}

export interface LivingDeckRun {
  state: LivingDeckState;
  topology: MarketTopology | null;
  hydrated: HydrateCompanyCardResult[];
  enrichmentFailures: EnrichmentFailure[];
  watch: SignalWatchResult | null;
  statuses: LivingDeckNodeStatus[];
  trace: readonly AdkTraceEvent[];
  summary: AdkTraceSummary;
  /** Time to a usable topology — the number that governs perceived speed. */
  bootMs: number | null;
  totalMs: number;
  aborted: boolean;
}

// ============================================================================
// 3. Declared graph
// ============================================================================

/**
 * The engine's agent graph as data.
 *
 * Declaring it separately from the executable nodes means the plan can be
 * validated, rendered, and reviewed without constructing agents or holding an
 * LLM client — and the shape stays checkable against the shared contract.
 */
export function describeAgentGraph(options: { watch?: boolean } = {}): AdkAgentGraph {
  const nodes = [
    {
      id: DISCOVERY_NODE_ID,
      kind: 'parallel',
      description: '3-vector market topology mapper',
      dependsOn: [],
      outputKey: TOPOLOGY_STATE_KEY,
      critical: true,
    },
    {
      id: ENRICHMENT_NODE_ID,
      kind: 'parallel',
      description: 'Parallel company hydration workers',
      dependsOn: [DISCOVERY_NODE_ID],
      outputKey: ENRICHMENT_STATE_KEY,
      critical: true,
    },
    ...(options.watch === false
      ? []
      : [
          {
            id: WATCHER_NODE_ID,
            kind: 'loop',
            description: 'Signal watcher & dynamic deck growth',
            dependsOn: [ENRICHMENT_NODE_ID],
            outputKey: WATCHER_STATE_KEY,
            // Growth is a bonus, not a precondition for a usable deck.
            critical: false,
          },
        ]),
  ];

  return adkAgentGraphSchema.parse({ nodes });
}

// ============================================================================
// 4. Engine
// ============================================================================

export class LivingDeckEngine {
  readonly telemetry: AdkTelemetryHub;

  private readonly options: LivingDeckEngineOptions;
  private state: LivingDeckState;

  constructor(options: LivingDeckEngineOptions) {
    this.options = options;
    this.telemetry =
      options.telemetry ??
      createAdkTelemetry({ rootAuthor: 'living_deck_engine', rootBranch: 'root' });
    this.state = createLivingDeckState(options.deckId);
    if (options.onTrace) this.telemetry.subscribe(options.onTrace);
  }

  /** Current reduced deck state. */
  getState(): LivingDeckState {
    return this.state;
  }

  subscribe(sink: AdkTraceSink): () => void {
    return this.telemetry.subscribe(sink);
  }

  private emit(event: LivingDeckEngineEvent): void {
    this.options.onEvent?.(event);
  }

  private applyDelta(delta: LivingDeckDelta): void {
    this.state = applyLivingDeckDelta(this.state, delta);
    this.emit({ type: 'delta', delta });
  }

  private setStatus(status: LivingDeckNodeStatus): void {
    this.state = upsertNodeStatus(this.state, status);
    this.emit({ type: 'node', status });
  }

  async run(): Promise<LivingDeckRun> {
    const { client, plan, deckId, signal } = this.options;
    const telemetry = this.telemetry;
    const watchEnabled = this.options.watch !== false;

    const rateLimiter =
      this.options.rateLimiter ??
      (this.options.requestsPerMinute
        ? createRateLimiter(this.options.requestsPerMinute)
        : undefined);

    telemetry.startInvocation('living deck run started', {
      deckId,
      market: plan.marketName,
      watch: watchEnabled,
    });
    const startedAt = telemetry.now();

    this.state = {
      ...this.state,
      status: 'booting',
      invocationId: telemetry.invocationId,
    };

    let bootMs: number | null = null;
    let topology: MarketTopology | null = null;
    const hydrated: HydrateCompanyCardResult[] = [];

    const discoveryNode = createDiscoveryNode({
      client,
      plan,
      telemetry,
      ...(this.options.discoveryTargets === undefined
        ? {}
        : { targets: this.options.discoveryTargets }),
      ...(signal === undefined ? {} : { signal }),
    });

    // Wrap discovery so the boot moment is measured where it actually happens.
    const instrumentedDiscovery = {
      ...discoveryNode,
      run: async (ctx: Parameters<typeof discoveryNode.run>[0]) => {
        const result = await discoveryNode.run(ctx);
        if (isMarketTopology(result)) {
          topology = result;
          bootMs = Math.max(0, telemetry.now() - startedAt);
          this.state = {
            ...this.state,
            status: 'hydrating',
            bootCompletedAt: new Date(telemetry.now()).toISOString(),
            counts: { ...this.state.counts, candidates: result.candidates.length },
          };
          this.emit({ type: 'boot', topology: result, elapsedMs: bootMs });
        }
        return result;
      },
    };

    const enrichmentNode = createEnrichmentNode({
      client,
      plan,
      telemetry,
      deckId,
      ...(this.options.enrichmentConcurrency === undefined
        ? {}
        : { concurrency: this.options.enrichmentConcurrency }),
      ...(this.options.maxCandidates === undefined
        ? {}
        : { maxCandidates: this.options.maxCandidates }),
      ...(rateLimiter === undefined ? {} : { rateLimiter }),
      ...(signal === undefined ? {} : { signal }),
      onCard: (result) => {
        hydrated.push(result);
        this.emit({ type: 'card', result });
      },
      onDelta: (delta) => this.applyDelta(delta),
    });

    const nodes: AdkTaskNode[] = [instrumentedDiscovery, enrichmentNode];

    if (watchEnabled) {
      nodes.push(
        createWatcherNode({
          client,
          plan,
          telemetry,
          deckId,
          ...(this.options.watchIterations === undefined
            ? {}
            : { maxIterations: this.options.watchIterations }),
          ...(rateLimiter === undefined ? {} : { rateLimiter }),
          ...(signal === undefined ? {} : { signal }),
          onCard: (card) => this.emit({ type: 'growth', card }),
          onDelta: (delta) => this.applyDelta(delta),
        }),
      );
    }

    const session = new AdkSession();
    const graphResult = await runAdkTaskGraph({
      nodes,
      telemetry,
      session,
      concurrency: this.options.graphConcurrency ?? 2,
      ...(signal === undefined ? {} : { signal }),
      onNodeState: (status) => this.setStatus(status),
    });

    const enrichment = session.read(ENRICHMENT_STATE_KEY, isEnrichmentPoolResult);
    const watch = session.read(WATCHER_STATE_KEY, isSignalWatchResult);

    const totalMs = Math.max(0, telemetry.now() - startedAt);
    const discoveryFailed = graphResult.failures.some(
      (failure) => failure.nodeId === DISCOVERY_NODE_ID,
    );

    this.state = {
      ...this.state,
      status: discoveryFailed ? 'failed' : 'settled',
      counts: {
        ...this.state.counts,
        hydrated: this.state.counts.hydrated,
        failed: enrichment?.failures.length ?? this.state.counts.failed,
      },
    };

    telemetry.endInvocation('living deck run finished', {
      deckId,
      hydrated: hydrated.length,
      totalMs,
      aborted: graphResult.aborted,
    });

    this.emit({ type: 'done', state: this.state });

    return {
      state: this.state,
      topology,
      hydrated,
      enrichmentFailures: enrichment?.failures ?? [],
      watch,
      statuses: graphResult.statuses,
      trace: telemetry.snapshot(),
      summary: telemetry.summary(),
      bootMs,
      totalMs,
      aborted: graphResult.aborted,
    };
  }
}

/** One-shot facade over {@link LivingDeckEngine}. */
export async function runLivingDeckEngine(
  options: LivingDeckEngineOptions,
): Promise<LivingDeckRun> {
  return new LivingDeckEngine(options).run();
}
