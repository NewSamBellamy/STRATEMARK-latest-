/**
 * ADK Telemetry Hub — the observable trace emitter for the Living Deck engine.
 *
 * Every subagent in the engine writes here, and everything downstream (the UI
 * activity feed, the FinOps receipt, the test suite) reads from here. That makes
 * this module the single place where "what actually happened" is recorded, so
 * an opaque multi-agent run becomes a reviewable causal tree.
 *
 * Design notes:
 *   1. **Spans, not log lines.** `startSpan` returns a handle that knows its own
 *      start time, branch, and parent. Durations are measured, never guessed,
 *      and a child span inherits its parent's branch path automatically.
 *   2. **Injectable clock and id factory.** Determinism is a first-class
 *      requirement: tests assert on exact event sequences, which is impossible
 *      if ids are random and timestamps are wall-clock. Production defaults to
 *      `Date.now` and a monotonic counter.
 *   3. **Sinks are isolated.** A subscriber that throws must not take down the
 *      research run it is merely observing, so every sink call is guarded.
 *   4. **Bounded memory.** The buffer is a ring: a long-running "watching" deck
 *      cannot leak unbounded trace history into the renderer process.
 */
import {
  composeBranch,
  summarizeTrace,
  type AdkAgentKind,
  type AdkAttributes,
  type AdkStateDelta,
  type AdkTraceError,
  type AdkTraceEvent,
  type AdkTraceLogger,
  type AdkTracePhase,
  type AdkTraceSeverity,
  type AdkTraceSink,
  type AdkTraceSummary,
  type AdkUnsubscribe,
} from '@mi/contracts';

// ============================================================================
// 1. Error normalization
// ============================================================================

function statusOf(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

/**
 * Convert an unknown throwable into a trace-safe error record.
 *
 * `retryable` follows the same rule the pipeline's `withRetry` uses — 429 and
 * 5xx are transient — with one deliberate exception: an abort is a decision,
 * not a failure to retry.
 */
export function toTraceError(err: unknown): AdkTraceError {
  if (err instanceof Error) {
    const status = statusOf(err);
    const retryable =
      err.name !== 'AbortError' && (status === 429 || (status !== null && status >= 500));
    return { name: err.name || 'Error', message: err.message, retryable };
  }
  return { name: 'UnknownError', message: String(err), retryable: false };
}

// ============================================================================
// 2. Options
// ============================================================================

export interface AdkTelemetryOptions {
  /** Correlation id for the whole run. Generated when omitted. */
  invocationId?: string;
  /** Name of the root agent (ADK `Event.author` for invocation-level events). */
  rootAuthor?: string;
  /** Root branch path. Defaults to `root`. */
  rootBranch?: string;
  /** Epoch-millisecond clock. Injectable so tests can assert exact durations. */
  clock?: () => number;
  /** Deterministic id factory, called with a monotonic sequence number. */
  idFactory?: (seq: number) => string;
  /** Ring-buffer capacity. Defaults to 2000 events. */
  maxBufferedEvents?: number;
  sinks?: readonly AdkTraceSink[];
  /** Notified when a sink throws. Defaults to swallowing the error. */
  onSinkError?: (err: unknown) => void;
}

export interface AdkSpanOptions {
  parent?: AdkSpan | null;
  /** Branch segment for this span; defaults to the author name. */
  branchSegment?: string;
  attributes?: AdkAttributes;
  /** Emit an `agent_start` event on creation. Defaults to true. */
  emitStart?: boolean;
}

// ============================================================================
// 3. Span
// ============================================================================

/**
 * A single unit of agent execution. Holds its own timing and identity so
 * callers never have to thread ids around by hand.
 */
export class AdkSpan {
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly branch: string;
  readonly author: string;
  readonly kind: AdkAgentKind;
  readonly startedAt: number;

  private readonly hub: AdkTelemetryHub;
  private closed = false;

  constructor(hub: AdkTelemetryHub, author: string, kind: AdkAgentKind, opts: AdkSpanOptions = {}) {
    this.hub = hub;
    this.author = author;
    this.kind = kind;
    this.spanId = hub.nextId('span');
    this.parentSpanId = opts.parent ? opts.parent.spanId : null;
    this.branch = composeBranch(
      opts.parent ? opts.parent.branch : hub.rootBranch,
      opts.branchSegment ?? author,
    );
    this.startedAt = hub.now();

    if (opts.emitStart !== false) {
      this.event('agent_start', `${author} started`, opts.attributes);
    }
  }

  /** True once `end` or `fail` has been called. */
  get isClosed(): boolean {
    return this.closed;
  }

  get elapsedMs(): number {
    return Math.max(0, this.hub.now() - this.startedAt);
  }

  /** Emit an arbitrary event on this span. */
  event(
    phase: AdkTracePhase,
    message = '',
    attributes: AdkAttributes = {},
    extra: {
      severity?: AdkTraceSeverity;
      durationMs?: number | null;
      stateDelta?: AdkStateDelta | null;
      error?: AdkTraceError | null;
      escalate?: boolean;
    } = {},
  ): AdkTraceEvent {
    const event: AdkTraceEvent = {
      id: this.hub.nextId('evt'),
      invocationId: this.hub.invocationId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      branch: this.branch,
      author: this.author,
      agentKind: this.kind,
      phase,
      severity: extra.severity ?? 'info',
      timestamp: this.hub.now(),
      durationMs: extra.durationMs ?? null,
      message,
      attributes,
      stateDelta: extra.stateDelta ?? null,
      error: extra.error ?? null,
      escalate: extra.escalate ?? false,
    };
    this.hub.emit(event);
    return event;
  }

  toolCall(tool: string, attributes: AdkAttributes = {}): AdkTraceEvent {
    return this.event('tool_call', `→ ${tool}`, { ...attributes, tool });
  }

  toolResult(tool: string, attributes: AdkAttributes = {}): AdkTraceEvent {
    return this.event('tool_result', `← ${tool}`, { ...attributes, tool });
  }

  /** Record a write to session state (ADK `actions.state_delta`). */
  stateDelta(delta: AdkStateDelta, message = 'state updated'): AdkTraceEvent {
    return this.event('state_delta', message, {}, { stateDelta: delta });
  }

  /** Record a streamed partial result — how the UI hydrates progressively. */
  chunk(message: string, attributes: AdkAttributes = {}): AdkTraceEvent {
    return this.event('stream_chunk', message, attributes);
  }

  /** ADK `actions.escalate` — ask the enclosing loop or graph to stop early. */
  escalate(reason: string, attributes: AdkAttributes = {}): AdkTraceEvent {
    return this.event('escalate', reason, attributes, { severity: 'warn', escalate: true });
  }

  warn(message: string, attributes: AdkAttributes = {}): AdkTraceEvent {
    return this.event('agent_end', message, attributes, { severity: 'warn' });
  }

  /** Open a nested span whose branch descends from this one. */
  child(author: string, kind: AdkAgentKind, opts: Omit<AdkSpanOptions, 'parent'> = {}): AdkSpan {
    return this.hub.startSpan(author, kind, { ...opts, parent: this });
  }

  end(attributes: AdkAttributes = {}, message?: string): AdkTraceEvent {
    const durationMs = this.elapsedMs;
    this.closed = true;
    return this.event('agent_end', message ?? `${this.author} finished`, attributes, {
      durationMs,
    });
  }

  fail(err: unknown, attributes: AdkAttributes = {}): AdkTraceEvent {
    const durationMs = this.elapsedMs;
    this.closed = true;
    const error = toTraceError(err);
    return this.event('error', `${this.author} failed: ${error.message}`, attributes, {
      severity: 'error',
      durationMs,
      error,
    });
  }
}

// ============================================================================
// 4. Hub
// ============================================================================

export class AdkTelemetryHub implements AdkTraceLogger {
  readonly invocationId: string;
  readonly rootAuthor: string;
  readonly rootBranch: string;

  private readonly clock: () => number;
  private readonly idFactory: (seq: number) => string;
  private readonly maxBufferedEvents: number;
  private readonly onSinkError: ((err: unknown) => void) | null;
  private readonly sinks = new Set<AdkTraceSink>();
  private readonly buffer: AdkTraceEvent[] = [];
  private seq = 0;
  private invocationStartedAt: number | null = null;

  constructor(opts: AdkTelemetryOptions = {}) {
    this.clock = opts.clock ?? (() => Date.now());
    this.idFactory = opts.idFactory ?? ((seq) => `${seq.toString(36)}`);
    this.maxBufferedEvents = Math.max(1, opts.maxBufferedEvents ?? 2000);
    this.onSinkError = opts.onSinkError ?? null;
    this.rootAuthor = opts.rootAuthor ?? 'living_deck_engine';
    this.rootBranch = opts.rootBranch ?? 'root';
    // Reserve sequence 0 for the invocation id so traces read predictably.
    this.invocationId = opts.invocationId ?? `inv-${this.idFactory(this.seq++)}`;
    for (const sink of opts.sinks ?? []) this.sinks.add(sink);
  }

  now(): number {
    return this.clock();
  }

  nextId(prefix: string): string {
    return `${prefix}-${this.idFactory(this.seq++)}`;
  }

  emit(event: AdkTraceEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.maxBufferedEvents) {
      this.buffer.splice(0, this.buffer.length - this.maxBufferedEvents);
    }
    for (const sink of this.sinks) {
      try {
        sink(event);
      } catch (err) {
        // Observers never break the observed. Report if asked, otherwise drop.
        this.onSinkError?.(err);
      }
    }
  }

  subscribe(sink: AdkTraceSink): AdkUnsubscribe {
    this.sinks.add(sink);
    return () => {
      this.sinks.delete(sink);
    };
  }

  snapshot(): readonly AdkTraceEvent[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer.length = 0;
  }

  summary(): AdkTraceSummary {
    return summarizeTrace(this.buffer);
  }

  startSpan(author: string, kind: AdkAgentKind, opts: AdkSpanOptions = {}): AdkSpan {
    return new AdkSpan(this, author, kind, opts);
  }

  /** Emit the run-level opening event. */
  startInvocation(message = 'living deck invocation started', attributes: AdkAttributes = {}): AdkTraceEvent {
    this.invocationStartedAt = this.now();
    return this.rootEvent('invocation_start', message, attributes, null);
  }

  /** Emit the run-level closing event, carrying total wall-clock duration. */
  endInvocation(message = 'living deck invocation finished', attributes: AdkAttributes = {}): AdkTraceEvent {
    const durationMs =
      this.invocationStartedAt === null ? null : Math.max(0, this.now() - this.invocationStartedAt);
    return this.rootEvent('invocation_end', message, attributes, durationMs);
  }

  private rootEvent(
    phase: AdkTracePhase,
    message: string,
    attributes: AdkAttributes,
    durationMs: number | null,
  ): AdkTraceEvent {
    const event: AdkTraceEvent = {
      id: this.nextId('evt'),
      invocationId: this.invocationId,
      spanId: this.invocationId,
      parentSpanId: null,
      branch: this.rootBranch,
      author: this.rootAuthor,
      agentKind: 'sequential',
      phase,
      severity: 'info',
      timestamp: this.now(),
      durationMs,
      message,
      attributes,
      stateDelta: null,
      error: null,
      escalate: false,
    };
    this.emit(event);
    return event;
  }
}

export function createAdkTelemetry(opts: AdkTelemetryOptions = {}): AdkTelemetryHub {
  return new AdkTelemetryHub(opts);
}

/**
 * A deterministic hub for tests and replay: ids are sequential and the clock
 * advances by a fixed step on every read, so a run produces byte-identical
 * traces every time.
 */
export function createDeterministicTelemetry(
  opts: AdkTelemetryOptions & { startAt?: number; stepMs?: number } = {},
): AdkTelemetryHub {
  const step = opts.stepMs ?? 1;
  let current = opts.startAt ?? 0;
  return new AdkTelemetryHub({
    ...opts,
    invocationId: opts.invocationId ?? 'inv-test',
    clock:
      opts.clock ??
      (() => {
        const value = current;
        current += step;
        return value;
      }),
    idFactory: opts.idFactory ?? ((seq) => String(seq)),
  });
}
