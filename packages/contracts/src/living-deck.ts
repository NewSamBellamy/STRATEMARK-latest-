/**
 * Living Deck Contracts — state, deltas, and the agent graph.
 *
 * A Living Deck is a deck that keeps researching itself. It boots fast with a
 * thin topology of stub cards, hydrates them in parallel, and then keeps
 * watching for new signal — so the deck a user opens on Tuesday is not the deck
 * they left on Monday. That behaviour needs three contracts:
 *
 *   1. **Agent graph** — the DAG of subagents, declared as data so it can be
 *      validated, visualized, and re-planned without touching the executor.
 *   2. **Deltas** — the append-only record of what changed and why. The deck's
 *      growth is a fold over these, which keeps the UI diff-driven rather than
 *      re-rendering a whole research run.
 *   3. **State** — the reduced view: node health, revision, and counts.
 *
 * Anti-fabrication is enforced *in the schema*, not merely by convention: a
 * `metric_revised` delta claiming `verified` without a citation is rejected at
 * the boundary, and an `unknown` figure must carry a null value. This mirrors
 * `enforceMetricProvenance` so a delta cannot smuggle in a number that the card
 * pipeline would have refused.
 */
import { z } from 'zod';
import { ADK_AGENT_KINDS } from './adk-trace';
import { cardTypeSchema, confidenceSchema, metricTypeSchema } from './schemas';

// ---------------------------------------------------------------------------
// Discovery vectors
// ---------------------------------------------------------------------------

/**
 * The three orthogonal directions the topology mapper searches along. Together
 * they describe a market as a supply chain rather than a flat list of rivals:
 * who operates in it, who supplies it, and who reaches its customers.
 */
export const DISCOVERY_VECTORS = [
  'core_operators',
  'infrastructure_supply',
  'distribution_channel',
] as const;
export type DiscoveryVector = (typeof DISCOVERY_VECTORS)[number];

export const DISCOVERY_VECTOR_LABELS: Record<DiscoveryVector, string> = {
  core_operators: 'Core Operators',
  infrastructure_supply: 'Infrastructure & Supply',
  distribution_channel: 'Distribution & Channel',
};

export const DISCOVERY_VECTOR_DESCRIPTIONS: Record<DiscoveryVector, string> = {
  core_operators: 'Companies selling their core product or service into the market.',
  infrastructure_supply: 'Suppliers of the compute, hardware, tooling, or platforms the market runs on.',
  distribution_channel: 'Channels, marketplaces, resellers, and integrators that reach the market’s customers.',
};

export const discoveryVectorSchema = z.enum(DISCOVERY_VECTORS);

// ---------------------------------------------------------------------------
// Node + deck lifecycle states
// ---------------------------------------------------------------------------

export const ADK_NODE_STATES = ['pending', 'running', 'succeeded', 'failed', 'skipped'] as const;
export type AdkNodeState = (typeof ADK_NODE_STATES)[number];

export const adkNodeStateSchema = z.enum(ADK_NODE_STATES);

/** Node states that will never change again. */
export const ADK_SETTLED_NODE_STATES: readonly AdkNodeState[] = ['succeeded', 'failed', 'skipped'];

export function isSettledNodeState(state: AdkNodeState): boolean {
  return ADK_SETTLED_NODE_STATES.includes(state);
}

export const LIVING_DECK_STATUSES = [
  'idle',
  'booting',
  'hydrating',
  'watching',
  'settled',
  'failed',
] as const;
export type LivingDeckStatus = (typeof LIVING_DECK_STATUSES)[number];

export const LIVING_DECK_STATUS_LABELS: Record<LivingDeckStatus, string> = {
  idle: 'Idle',
  booting: 'Booting',
  hydrating: 'Hydrating',
  watching: 'Watching for signal',
  settled: 'Settled',
  failed: 'Failed',
};

export const livingDeckStatusSchema = z.enum(LIVING_DECK_STATUSES);

// ---------------------------------------------------------------------------
// Agent graph
// ---------------------------------------------------------------------------

export const adkAgentNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(ADK_AGENT_KINDS),
  description: z.string().default(''),
  dependsOn: z.array(z.string().min(1)).default([]),
  /**
   * ADK `output_key`: where this node's result lands in session state so
   * downstream nodes can read it.
   */
  outputKey: z.string().min(1).nullable().default(null),
  /** When true, a failure here aborts the run instead of skipping dependents. */
  critical: z.boolean().default(true),
});
export type AdkAgentNode = z.infer<typeof adkAgentNodeSchema>;

/**
 * Find one dependency cycle, if any, using an iterative DFS with a colour map.
 * Returns the offending path (`a → b → a`) or null when the graph is acyclic.
 * Iterative rather than recursive so a pathological plan cannot blow the stack.
 */
export function detectGraphCycle(nodes: readonly AdkAgentNode[]): string[] | null {
  const adjacency = new Map<string, readonly string[]>();
  for (const node of nodes) adjacency.set(node.id, node.dependsOn);

  const VISITING = 1;
  const DONE = 2;
  const marks = new Map<string, number>();

  for (const node of nodes) {
    if (marks.get(node.id) === DONE) continue;

    const path: string[] = [];
    const stack: Array<{ id: string; cursor: number }> = [{ id: node.id, cursor: 0 }];
    marks.set(node.id, VISITING);
    path.push(node.id);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame === undefined) break;
      const deps = adjacency.get(frame.id) ?? [];

      if (frame.cursor >= deps.length) {
        marks.set(frame.id, DONE);
        stack.pop();
        path.pop();
        continue;
      }

      const next = deps[frame.cursor];
      frame.cursor += 1;
      if (next === undefined || !adjacency.has(next)) continue;

      const mark = marks.get(next);
      if (mark === VISITING) {
        const start = path.indexOf(next);
        return [...path.slice(start >= 0 ? start : 0), next];
      }
      if (mark === DONE) continue;

      marks.set(next, VISITING);
      path.push(next);
      stack.push({ id: next, cursor: 0 });
    }
  }

  return null;
}

/**
 * A validated agent DAG. The refinement is where plan bugs die: duplicate ids,
 * dangling dependencies, self-edges, and cycles are all rejected before the
 * executor ever schedules a node.
 */
export const adkAgentGraphSchema = z
  .object({
    nodes: z.array(adkAgentNodeSchema).min(1),
  })
  .superRefine((graph, ctx) => {
    const seen = new Set<string>();
    for (const node of graph.nodes) {
      if (seen.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes'],
          message: `Duplicate agent node id: ${node.id}`,
        });
      }
      seen.add(node.id);
    }

    for (const node of graph.nodes) {
      if (node.dependsOn.includes(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes'],
          message: `Agent node "${node.id}" depends on itself.`,
        });
      }
      for (const dep of node.dependsOn) {
        if (!seen.has(dep)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['nodes'],
            message: `Agent node "${node.id}" depends on unknown node "${dep}".`,
          });
        }
      }
    }

    const cycle = detectGraphCycle(graph.nodes);
    if (cycle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nodes'],
        message: `Agent graph contains a cycle: ${cycle.join(' → ')}`,
      });
    }
  });
export type AdkAgentGraph = z.infer<typeof adkAgentGraphSchema>;

// ---------------------------------------------------------------------------
// Deltas
// ---------------------------------------------------------------------------

export const LIVING_DECK_DELTA_KINDS = [
  'card_added',
  'card_updated',
  'card_removed',
  'metric_revised',
  'signal_attached',
  'topology_expanded',
] as const;
export type LivingDeckDeltaKind = (typeof LIVING_DECK_DELTA_KINDS)[number];

export const LIVING_DECK_DELTA_KIND_LABELS: Record<LivingDeckDeltaKind, string> = {
  card_added: 'Card added',
  card_updated: 'Card updated',
  card_removed: 'Card removed',
  metric_revised: 'Metric revised',
  signal_attached: 'Signal attached',
  topology_expanded: 'Topology expanded',
};

const deltaBaseShape = {
  id: z.string().min(1),
  deckId: z.string().min(1),
  /** ISO-8601 timestamp. */
  at: z.string().min(1),
  /** Agent that produced the delta — ties the change back to the trace. */
  author: z.string().min(1),
  invocationId: z.string().min(1).nullable().default(null),
};

export const livingDeckDeltaSchema = z
  .discriminatedUnion('kind', [
    z.object({
      ...deltaBaseShape,
      kind: z.literal('card_added'),
      cardId: z.string().min(1),
      cardType: cardTypeSchema,
      title: z.string().min(1),
      vector: discoveryVectorSchema.nullable().default(null),
    }),
    z.object({
      ...deltaBaseShape,
      kind: z.literal('card_updated'),
      cardId: z.string().min(1),
      /** Names of the fields this delta rewrote. */
      fields: z.array(z.string().min(1)).default([]),
    }),
    z.object({
      ...deltaBaseShape,
      kind: z.literal('card_removed'),
      cardId: z.string().min(1),
      reason: z.string().min(1),
    }),
    z.object({
      ...deltaBaseShape,
      kind: z.literal('metric_revised'),
      cardId: z.string().min(1),
      metricType: metricTypeSchema,
      value: z.number().nullable(),
      confidence: confidenceSchema,
      /** Which rung of the proxy waterfall produced this figure (1–4). */
      proxyTier: z.number().int().min(1).max(4).nullable().default(null),
      citationUrl: z.string().url().nullable().default(null),
    }),
    z.object({
      ...deltaBaseShape,
      kind: z.literal('signal_attached'),
      cardId: z.string().min(1),
      signalType: cardTypeSchema,
      claimTitle: z.string().min(1),
      citationUrl: z.string().url().nullable().default(null),
    }),
    z.object({
      ...deltaBaseShape,
      kind: z.literal('topology_expanded'),
      vector: discoveryVectorSchema,
      addedCandidates: z.number().int().nonnegative(),
    }),
  ])
  .superRefine((delta, ctx) => {
    // The product's central rule, enforced at the boundary rather than trusted:
    // a figure is only "verified" if a human could go and check it.
    if (delta.kind === 'metric_revised') {
      if (delta.confidence === 'verified' && delta.citationUrl === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confidence'],
          message:
            'A "verified" metric delta requires a citationUrl; downgrade it to "estimated" instead.',
        });
      }
      if (delta.confidence === 'unknown' && delta.value !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'An "unknown" metric delta must carry a null value.',
        });
      }
    }

    // Unsourced vice claims are dropped, never displayed.
    if (delta.kind === 'signal_attached' && delta.signalType === 'vice' && delta.citationUrl === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['citationUrl'],
        message: 'A vice signal requires a citationUrl; unsourced vice claims must be dropped.',
      });
    }
  });
export type LivingDeckDelta = z.infer<typeof livingDeckDeltaSchema>;

// ---------------------------------------------------------------------------
// Reduced state
// ---------------------------------------------------------------------------

export const livingDeckNodeStatusSchema = z.object({
  nodeId: z.string().min(1),
  state: adkNodeStateSchema,
  startedAt: z.string().nullable().default(null),
  endedAt: z.string().nullable().default(null),
  durationMs: z.number().nonnegative().nullable().default(null),
  attempts: z.number().int().nonnegative().default(0),
  error: z.string().nullable().default(null),
});
export type LivingDeckNodeStatus = z.infer<typeof livingDeckNodeStatusSchema>;

export const livingDeckCountsSchema = z.object({
  candidates: z.number().int().nonnegative().default(0),
  hydrated: z.number().int().nonnegative().default(0),
  failed: z.number().int().nonnegative().default(0),
});
export type LivingDeckCounts = z.infer<typeof livingDeckCountsSchema>;

export const livingDeckStateSchema = z.object({
  deckId: z.string().min(1),
  status: livingDeckStatusSchema.default('idle'),
  /** Monotonic; bumped by every applied delta so clients can detect staleness. */
  revision: z.number().int().nonnegative().default(0),
  invocationId: z.string().min(1).nullable().default(null),
  bootCompletedAt: z.string().nullable().default(null),
  lastDeltaAt: z.string().nullable().default(null),
  nodes: z.array(livingDeckNodeStatusSchema).default([]),
  deltas: z.array(livingDeckDeltaSchema).default([]),
  counts: livingDeckCountsSchema.default({ candidates: 0, hydrated: 0, failed: 0 }),
});
export type LivingDeckState = z.infer<typeof livingDeckStateSchema>;

export function createLivingDeckState(deckId: string): LivingDeckState {
  return livingDeckStateSchema.parse({ deckId });
}

/**
 * Fold one delta into the deck state. Immutable — returns a new object so the
 * renderer can diff by reference and the caller keeps an undo trail for free.
 */
export function applyLivingDeckDelta(
  state: LivingDeckState,
  delta: LivingDeckDelta,
): LivingDeckState {
  const counts: LivingDeckCounts = { ...state.counts };

  switch (delta.kind) {
    case 'card_added':
      counts.hydrated += 1;
      break;
    case 'card_removed':
      counts.hydrated = Math.max(0, counts.hydrated - 1);
      break;
    case 'topology_expanded':
      counts.candidates += delta.addedCandidates;
      break;
    case 'card_updated':
    case 'metric_revised':
    case 'signal_attached':
      break;
    default:
      break;
  }

  return {
    ...state,
    revision: state.revision + 1,
    lastDeltaAt: delta.at,
    deltas: [...state.deltas, delta],
    counts,
  };
}

/** Fold a batch of deltas in order. */
export function applyLivingDeckDeltas(
  state: LivingDeckState,
  deltas: readonly LivingDeckDelta[],
): LivingDeckState {
  return deltas.reduce<LivingDeckState>(
    (acc, delta) => applyLivingDeckDelta(acc, delta),
    state,
  );
}

/** Merge a node status into the state, replacing any prior entry for that node. */
export function upsertNodeStatus(
  state: LivingDeckState,
  status: LivingDeckNodeStatus,
): LivingDeckState {
  const nodes = state.nodes.filter((node) => node.nodeId !== status.nodeId);
  nodes.push(status);
  const failed = nodes.filter((node) => node.state === 'failed').length;
  return { ...state, nodes, counts: { ...state.counts, failed } };
}
