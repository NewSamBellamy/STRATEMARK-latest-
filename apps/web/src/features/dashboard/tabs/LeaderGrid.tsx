/**
 * LeaderGrid — the human face of the org chart.
 *
 * A row of framed portrait cards above the reporting-lines graph: headshot,
 * name, role. Hover reveals the person's sourced background; click opens the
 * full profile with grounded dig-deeper.
 *
 * Headshot honesty: photos come from Wikipedia's public REST API and are used
 * ONLY when the article summary actually mentions the company — a mismatched
 * photo of a same-named stranger is worse than initials. No match → clean
 * initials tile. Never fabricated, never guessed.
 */
import { useEffect, useState } from 'react';
import type { OrgNode } from '@mi/contracts';
import { cn } from '@/lib/cn';

interface Headshot {
  thumb: string;
  sourceUrl: string;
}

const headshotCache = new Map<string, Headshot | null>();

async function fetchWikiHeadshot(
  personName: string,
  companyName: string,
): Promise<Headshot | null> {
  const key = `${personName}::${companyName}`;
  if (headshotCache.has(key)) return headshotCache.get(key) ?? null;
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(personName)}`,
      { headers: { accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      thumbnail?: { source?: string };
      extract?: string;
      description?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    const text = `${data.extract ?? ''} ${data.description ?? ''}`.toLowerCase();
    const mentionsCompany = text.includes(companyName.toLowerCase());
    const thumb = data.thumbnail?.source;
    const result =
      mentionsCompany && thumb
        ? { thumb, sourceUrl: data.content_urls?.desktop?.page ?? '' }
        : null;
    headshotCache.set(key, result);
    return result;
  } catch {
    headshotCache.set(key, null);
    return null;
  }
}

const GROUP_RING: Record<OrgNode['group'], string> = {
  exec: 'ring-indigo-400/60',
  ai: 'ring-cyan-400/60',
  product: 'ring-emerald-400/60',
  design: 'ring-pink-400/60',
  other: 'ring-slate-300/60',
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/**
 * Reusable honest-headshot avatar: Wikipedia photo when the article verifiably
 * matches the person AND company, initials otherwise. Shared by the leadership
 * grid and the board/investor treatment.
 */
export function WikiAvatar({
  name,
  companyName,
  size = 'md',
  ringClass = 'ring-slate-300/60',
}: {
  name: string;
  companyName: string;
  size?: 'sm' | 'md';
  ringClass?: string;
}) {
  const [shot, setShot] = useState<Headshot | null>(null);
  useEffect(() => {
    let live = true;
    void fetchWikiHeadshot(name, companyName).then((s) => {
      if (live) setShot(s);
    });
    return () => {
      live = false;
    };
  }, [name, companyName]);
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-offset-2 ring-offset-surface',
        size === 'sm' ? 'h-10 w-10' : 'h-14 w-14',
        ringClass,
      )}
    >
      {shot ? (
        <img src={shot.thumb} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span
          className={cn(
            'font-display font-semibold text-primary-ink',
            size === 'sm' ? 'text-sm' : 'text-base',
          )}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

function LeaderCard({
  person,
  companyName,
  onOpen,
}: {
  person: OrgNode;
  companyName: string;
  onOpen: () => void;
}) {
  const [shot, setShot] = useState<Headshot | null>(null);
  useEffect(() => {
    let live = true;
    void fetchWikiHeadshot(person.name, companyName).then((s) => {
      if (live) setShot(s);
    });
    return () => {
      live = false;
    };
  }, [person.name, companyName]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/leader relative flex w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-xl border border-transparent p-2 text-center transition-colors hover:border-border hover:bg-surface-2"
    >
      <span
        className={cn(
          'grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-offset-2 ring-offset-surface',
          GROUP_RING[person.group],
        )}
      >
        {shot ? (
          <img
            src={shot.thumb}
            alt={person.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="font-display text-base font-semibold text-primary-ink">
            {initialsOf(person.name)}
          </span>
        )}
      </span>
      <span className="w-full truncate text-[12px] font-semibold leading-tight text-content">
        {person.name}
      </span>
      <span className="w-full truncate text-[10.5px] leading-tight text-muted">{person.role}</span>

      {/* Hover profile — the sourced background, in place. */}
      {/* Left-aligned (not centered): a centered popover on a card near the
          screen's left edge clipped half of every line off-screen. */}
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-60 max-w-[70vw] rounded-lg border border-border bg-surface p-3 text-left shadow-card group-hover/leader:block">
        <span className="block text-[12px] font-semibold text-content">{person.name}</span>
        <span className="block text-[11px] text-muted">{person.role}</span>
        <span className="mt-1.5 block text-[11px] leading-relaxed text-content/85">
          {person.bio?.trim() ||
            'No sourced background yet — click to open the profile and research them.'}
        </span>
        <span className="mt-1.5 block text-[10px] font-medium text-primary-ink">
          Click for full profile & grounded research →
        </span>
      </span>
    </button>
  );
}

export function LeaderGrid({
  nodes,
  companyName,
  onOpenPerson,
}: {
  nodes: OrgNode[];
  companyName: string;
  onOpenPerson: (id: string) => void;
}) {
  // Exec row first, then everyone else in stored order.
  const ordered = [...nodes].sort((a, b) =>
    a.group === b.group ? 0 : a.group === 'exec' ? -1 : b.group === 'exec' ? 1 : 0,
  );
  if (ordered.length === 0) return null;
  return (
    <div className="panel mb-4 overflow-visible p-3">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Leadership · {ordered.length} people
      </p>
      <div className="flex flex-wrap gap-1">
        {ordered.map((p) => (
          <LeaderCard
            key={p.id}
            person={p}
            companyName={companyName}
            onOpen={() => onOpenPerson(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
