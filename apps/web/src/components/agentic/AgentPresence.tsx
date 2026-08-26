/**
 * The floating STRATEMARK presence — the founder's ask, verbatim: "a floating
 * S logo that tells you the current agent calls… labeled — sub-agent for this
 * company card found this and this… you can move it anywhere… click it and it
 * pops open the logs… and an option to chat with the AI of that specific deck."
 *
 * The bubble is draggable (position persists), pulses only while agents are
 * GENUINELY working (live fetch/mutation state + the trace stream), and opens
 * into a labeled activity log with a chat entry anchored to the current deck
 * or company. Everything shown is a real emitted event — never theater.
 */
import { useEffect, useRef, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { MessagesSquare, Minus, ListTree } from 'lucide-react';
import { useAgentTrace } from '@/lib/agentic/agentTrace';
import { useDeepDive } from '@/features/deepdive/DeepDive';
import { cn } from '@/lib/cn';
import wordmark from '@/assets/wordmark.svg';

const POS_KEY = 'stratemark_presence_pos';

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number };
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
    }
  } catch {
    // default below
  }
  return { x: -1, y: -1 }; // sentinel → bottom-right default on first paint
}

function agoLabel(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export function AgentPresence() {
  const events = useAgentTrace((s) => s.events);
  const jobs = useAgentTrace((s) => s.jobs);
  const chatContext = useAgentTrace((s) => s.chatContext);
  const { chat } = useDeepDive();

  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const queuedHunts = jobs.filter((j) => j.status === 'queued').length;
  const runningHunts = jobs.filter((j) => j.status === 'running').length;
  const activeCount = fetching + mutating + runningHunts;
  const busy = activeCount > 0;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(loadPos);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Resolve the sentinel default AFTER mount (needs viewport size).
  useEffect(() => {
    if (pos.x === -1) {
      setPos({ x: window.innerWidth - 76, y: window.innerHeight - 140 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(Math.max(8, p.x), window.innerWidth - 60),
    y: Math.min(Math.max(8, p.y), window.innerHeight - 60),
  });

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setPos(clamp({ x: d.baseX + dx, y: d.baseY + dy }));
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d) {
      if (!d.moved) {
        setOpen((o) => !o);
      } else {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(pos));
        } catch {
          // best effort
        }
      }
    }
  };

  if (pos.x === -1) return null;

  // Panel opens toward the free half of the screen.
  const panelLeft = pos.x > window.innerWidth / 2;
  const panelAbove = pos.y > window.innerHeight / 2;

  return (
    <div ref={rootRef} className="fixed z-[60]" style={{ left: pos.x, top: pos.y }}>
      {/* The bubble — drag to move, click to open. */}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title={
          busy
            ? `Agents working — ${activeCount} live call${activeCount === 1 ? '' : 's'}${queuedHunts > 0 ? `, ${queuedHunts} hunt${queuedHunts === 1 ? '' : 's'} queued` : ''}. Click for the activity log; drag to move.`
            : 'Agent activity log — click to open; drag to move.'
        }
        className={cn(
          'relative grid h-12 w-12 cursor-grab touch-none select-none place-items-center rounded-full border border-border bg-surface shadow-card transition-transform hover:scale-105 active:cursor-grabbing',
          busy && 'mi-presence-glow border-primary/40',
        )}
        aria-label="Agent activity"
      >
        {/* The brand mark, breathing a soft glow while agents work — the old
            ping ring read as an alarm; presence should feel like a heartbeat. */}
        <img
          src={wordmark}
          alt=""
          draggable={false}
          className={cn('h-7 w-7 select-none', busy && 'mi-presence-active')}
        />
        {(busy || queuedHunts > 0) && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow">
            {activeCount + queuedHunts}
          </span>
        )}
      </button>

      {/* The activity log — labeled sub-agent stream + chat entry. */}
      {open && (
        <div
          className={cn(
            'absolute w-[340px] max-w-[88vw] overflow-hidden rounded-xl border border-border bg-surface shadow-card',
            panelLeft ? 'right-14' : 'left-14',
            panelAbove ? 'bottom-0' : 'top-0',
          )}
        >
          <div className="flex items-center gap-2 border-b border-border bg-surface-2/70 px-3 py-2">
            <ListTree className="h-3.5 w-3.5 text-muted" />
            <span className="text-[12px] font-semibold text-content">Agent activity</span>
            <span className="text-[10px] text-faint">
              {busy
                ? `${activeCount} live${queuedHunts > 0 ? ` · ${queuedHunts} queued` : ''}`
                : 'idle'}
            </span>
            <span className="ml-auto flex items-center gap-1">
              {chatContext && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[10.5px] font-medium text-content transition-colors hover:bg-surface-2"
                  title={`Chat with the AI of ${chatContext.subject} — grounded in this deck's synthesized research`}
                  onClick={() => {
                    setOpen(false);
                    chat(
                      chatContext.kind === 'deck'
                        ? { kind: 'deck', deckId: chatContext.deckId as string }
                        : {
                            kind: 'company',
                            deckId: null,
                            companyId: chatContext.companyId as string,
                            subject: chatContext.subject,
                          },
                      { placeholder: `Ask about ${chatContext.subject}…` },
                    );
                  }}
                >
                  <MessagesSquare className="h-3 w-3" />
                  Chat
                </button>
              )}
              <button
                type="button"
                className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-content"
                onClick={() => setOpen(false)}
                aria-label="Minimize"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>

          <div className="max-h-[300px] overflow-y-auto p-2">
            {/* Queued hunts first — the user's clicks, in order. */}
            {jobs.filter((j) => j.status === 'queued' || j.status === 'running').length > 0 && (
              <div className="mb-1.5 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5">
                {jobs
                  .filter((j) => j.status === 'queued' || j.status === 'running')
                  .map((j, i) => (
                    <p key={j.id} className="flex items-center gap-1.5 py-0.5 text-[11px] text-muted">
                      {j.status === 'running' ? (
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </span>
                      ) : (
                        <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-surface text-[8px] font-bold text-faint">
                          {i}
                        </span>
                      )}
                      <span className="truncate">
                        {j.status === 'running' ? 'Hunting: ' : 'Queued: '}
                        {j.label}
                      </span>
                    </p>
                  ))}
              </div>
            )}

            {events.length === 0 ? (
              <p className="px-2 py-4 text-center text-[11px] text-faint">
                Quiet for now — agent actions appear here the moment they happen: hunts,
                verifications, section research, corrections.
              </p>
            ) : (
              <ul>
                {events.map((e) => (
                  <li key={e.id} className="flex gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2/60">
                    <span className="mt-0.5 shrink-0 text-[9px] font-semibold tabular-nums text-faint">
                      {agoLabel(e.at)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-ink">
                        {e.agent}
                      </span>
                      <span className="block text-[11.5px] leading-snug text-content">{e.action}</span>
                      {e.detail && (
                        <span className="block truncate text-[10.5px] text-muted">{e.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
