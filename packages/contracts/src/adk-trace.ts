/**
 * ADK Execution Trace Contracts — Living Deck observability substrate.
 *
 * Google's Agent Development Kit models an agent run as a stream of `Event`s
 * carrying an author, an invocation id, a branch path through the agent tree,
 * and an `actions.state_delta` describing what the step changed. This module
 * encodes that same event grammar as the project's zod-first contract so every
 * subagent in the Living Deck engine is observable through one schema, whether
 * it is orchestrated in-process today or handed to an ADK runner tomorrow.
 *
 * Design notes:
 *   1. Const tuples are the source of truth; zod enums and TS unions are both
 *      derived from them, exactly as in `enums.ts`.
 *   2. Attributes are deliberately restricted to OpenTelemetry-shaped scalars
 *      (and scalar arrays). A trace event must stay cheaply serializable and
 *      safe to ship to a log sink — it is not a place to smuggle domain objects.
 *   3. Nothing here performs I/O. The contract defines the event and the sink
 *      interface; `@mi/research`'s telemetry hub is the emitter.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Agent kinds — the ADK composition primitives
// ---------------------------------------------------------------------------

/**
 * ADK's workflow agents compose deterministically (`sequential`, `parallel`,
 * `loop`) around leaf `llm` agents. `pool_worker` is our bounded-concurrency
 * fan-out worker — a ParallelAgent whose branch count is capped at runtime
 * rather than fixed at construction.
 */
export const ADK_AGENT_KINDS = [
  'llm',
  'sequential',
  'parallel',
  'loop',
  'pool_worker',
  'custom',
] as const;
export type AdkAgentKind = (typeof ADK_AGENT_KINDS)[number];

export const ADK_AGENT_KIND_LABELS: Record<AdkAgentKind, string> = {
  llm: 'LLM Agent',
  sequential: 'Sequential Agent',
  parallel: 'Parallel Agent',
  loop: 'Loop Agent',
  pool_worker: 'Pool Worker',
  custom: 'Custom Agent',
};

// ---------------------------------------------------------------------------
// Trace phases
// ---------------------------------------------------------------------------

export const ADK_TRACE_PHASES = [
  'invocation_start',
  'agent_start',
  'agent_end',
  'tool_call',
  'tool_result',
  'state_delta',
  'stream_chunk',
  'escalate',
  'error',
  'invocation_end',
] as const;
export type AdkTracePhase = (typeof ADK_TRACE_PHASES)[number];

export const ADK_TRACE_PHASE_LABELS: Record<AdkTracePhase, string> = {
  invocation_start: 'Invocation started',
  agent_start: 'Agent started',
  agent_end: 'Agent finished',
  tool_call: 'Tool called',
  tool_result: 'Tool returned',
  state_delta: 'State delta applied',
  stream_chunk: 'Streamed chunk',
  escalate: 'Escalated',
  error: 'Error',
  invocation_end: 'Invocation finished',
};

/** Phases that close a span or a run — useful for trace folding in the UI. */
export const ADK_TERMINAL_PHASES: readonly AdkTracePhase[] = [
  'agent_end',
  'error',
  'invocation_end',
];

export function isTerminalPhase(phase: AdkTracePhase): boolean {
  return ADK_TERMINAL_PHASES.includes(phase);
}

export const ADK_TRACE_SEVERITIES = ['debug', 'info', 'warn', 'error'] as const;
export type AdkTraceSeverity = (typeof ADK_TRACE_SEVERITIES)[number];

// ---------------------------------------------------------------------------
// Attribute + state-delta value space
// ---------------------------------------------------------------------------

/**
 * OpenTelemetry-shaped attribute values: scalars, or homogeneous scalar arrays.
 * Rich domain objects belong in session state, not in the trace.
 */
export const adkAttributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);
export type AdkAttributeValue = z.infer<typeof adkAttributeValueSchema>;

export const adkAttributesSchema = z.record(adkAttributeValueSchema);
export type AdkAttributes = z.infer<typeof adkAttributesSchema>;

/** ADK `EventActions.state_delta` — the keys this step wrote to session state. */
export const adkStateDeltaSchema = z.record(adkAttributeValueSchema);
export type AdkStateDelta = z.infer<typeof adkStateDeltaSchema>;

export const adkTraceErrorSchema = z.object({
  name: z.string().min(1),
  message: z.string(),
  /** True when the orchestrator may retry the step (429s, 5xx, transient I/O). */
  retryable: z.boolean().default(false),
});
export type AdkTraceError = z.infer<typeof adkTraceErrorSchema>;

// ---------------------------------------------------------------------------
// The trace event
// ---------------------------------------------------------------------------

/** Separator for ADK branch paths, e.g. `root.discovery.infrastructure`. */
export const ADK_BRANCH_SEPARATOR = '.';

export function composeBranch(parent: string, child: string): string {
  const head = parent.trim();
  const tail = child.trim();
  if (!head) return tail;
  if (!tail) return head;
  return `${head}${ADK_BRANCH_SEPARATOR}${tail}`;
}

/**
 * One structured observation from the agent tree.
 *
 * `spanId`/`parentSpanId` give the causal tree, `branch` gives the human-readable
 * path, and `invocationId` correlates every event produced by a single run.
 */
export const adkTraceEventSchema = z.object({
  id: z.string().min(1),
  /** Correlates all events in one Living Deck run. */
  invocationId: z.string().min(1),
  spanId: z.string().min(1),
  parentSpanId: z.string().min(1).nullable().default(null),
  /** Dotted path through the agent tree, e.g. `root.enrichment.worker-3`. */
  branch: z.string().min(1),
  /** Name of the agent that produced the event (ADK `Event.author`). */
  author: z.string().min(1),
  agentKind: z.enum(ADK_AGENT_KINDS),
  phase: z.enum(ADK_TRACE_PHASES),
  severity: z.enum(ADK_TRACE_SEVERITIES).default('info'),
  /** Epoch milliseconds. */
  timestamp: z.number().int().nonnegative(),
  /** Wall-clock duration of the span; only set on closing events. */
  durationMs: z.number().nonnegative().nullable().default(null),
  message: z.string().default(''),
  attributes: adkAttributesSchema.default({}),
  stateDelta: adkStateDeltaSchema.nullable().default(null),
  error: adkTraceErrorSchema.nullable().default(null),
  /** ADK `actions.escalate` — signals a loop/graph should stop early. */
  escalate: z.boolean().default(false),
});
export type AdkTraceEvent = z.infer<typeof adkTraceEventSchema>;

export function isFailureEvent(event: AdkTraceEvent): boolean {
  return event.phase === 'error' || event.severity === 'error' || event.error !== null;
}

// ---------------------------------------------------------------------------
// Sinks + logger interface
// ---------------------------------------------------------------------------

/**
 * A trace consumer. Sinks must never throw into the agent path — the emitter
 * isolates them, but a well-behaved sink stays cheap and non-blocking.
 */
export type AdkTraceSink = (event: AdkTraceEvent) => void;

export type AdkUnsubscribe = () => void;

export interface AdkTraceLogger {
  emit(event: AdkTraceEvent): void;
  subscribe(sink: AdkTraceSink): AdkUnsubscribe;
  /** Most recent buffered events, oldest first. */
  snapshot(): readonly AdkTraceEvent[];
}

// ---------------------------------------------------------------------------
// Trace summarization
// ---------------------------------------------------------------------------

export interface AdkAuthorTiming {
  author: string;
  /** Number of completed spans attributed to this author. */
  spans: number;
  totalDurationMs: number;
  errors: number;
}

export interface AdkTraceSummary {
  invocationIds: string[];
  totalEvents: number;
  eventsByPhase: Record<AdkTracePhase, number>;
  errorCount: number;
  escalated: boolean;
  /** Span of the whole trace, from the earliest to the latest timestamp. */
  wallClockMs: number;
  authors: AdkAuthorTiming[];
}

function emptyPhaseCounts(): Record<AdkTracePhase, number> {
  const counts = {} as Record<AdkTracePhase, number>;
  for (const phase of ADK_TRACE_PHASES) counts[phase] = 0;
  return counts;
}

/**
 * Fold a trace into a reviewable receipt: what ran, how long it took, what
 * failed. Pure and allocation-light so it is safe to call on every UI tick.
 */
export function summarizeTrace(events: readonly AdkTraceEvent[]): AdkTraceSummary {
  const eventsByPhase = emptyPhaseCounts();
  const invocationIds: string[] = [];
  const timings = new Map<string, AdkAuthorTiming>();
  let errorCount = 0;
  let escalated = false;
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    eventsByPhase[event.phase] += 1;
    if (!invocationIds.includes(event.invocationId)) invocationIds.push(event.invocationId);
    if (isFailureEvent(event)) errorCount += 1;
    if (event.escalate) escalated = true;
    if (event.timestamp < earliest) earliest = event.timestamp;
    if (event.timestamp > latest) latest = event.timestamp;

    const timing = timings.get(event.author) ?? {
      author: event.author,
      spans: 0,
      totalDurationMs: 0,
      errors: 0,
    };
    if (event.durationMs !== null) {
      timing.spans += 1;
      timing.totalDurationMs += event.durationMs;
    }
    if (isFailureEvent(event)) timing.errors += 1;
    timings.set(event.author, timing);
  }

  return {
    invocationIds,
    totalEvents: events.length,
    eventsByPhase,
    errorCount,
    escalated,
    wallClockMs: events.length ? Math.max(0, latest - earliest) : 0,
    authors: Array.from(timings.values()),
  };
}
