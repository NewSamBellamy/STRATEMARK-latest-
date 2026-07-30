/**
 * Repeatable generative artwork for non-company cards (Insight, Barrier, Vice,
 * Culture). Costs nothing, needs no key, and is deterministic: the same title
 * always draws the same art, so a re-render or re-open never reshuffles the
 * deck's look. Each type has its own motif and palette so the card reads at a
 * glance, in any market.
 */
import { useMemo } from 'react';
import type { CardType } from '@mi/contracts';

/** Small deterministic PRNG seeded from a string (mulberry32 over a hash). */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE: Partial<Record<CardType, { a: string; b: string; ink: string }>> = {
  insight: { a: '#6366F1', b: '#A5B4FC', ink: '#4338CA' },
  barrier: { a: '#64748B', b: '#94A3B8', ink: '#475569' },
  vice: { a: '#F43F5E', b: '#FDA4AF', ink: '#BE123C' },
  culture: { a: '#10B981', b: '#6EE7B7', ink: '#047857' },
};

export function MarketCardArt({ type, seed }: { type: CardType; seed: string }) {
  const art = useMemo(() => {
    const r = rng(`${type}|${seed}`);
    const p = PALETTE[type] ?? PALETTE.barrier!;
    const el: string[] = [];

    if (type === 'insight') {
      // Radiating arcs — a signal propagating outward from a found point.
      const cx = 50 + (r() - 0.5) * 24;
      const cy = 58 + (r() - 0.5) * 12;
      for (let i = 0; i < 5; i++) {
        const rad = 10 + i * (9 + r() * 3);
        el.push(
          `<circle cx="${cx}" cy="${cy}" r="${rad.toFixed(1)}" fill="none" stroke="${i % 2 ? p.b : p.a}" stroke-width="${(2.4 - i * 0.35).toFixed(2)}" opacity="${(0.85 - i * 0.13).toFixed(2)}" ${i > 1 ? `stroke-dasharray="${(3 + r() * 6).toFixed(1)} ${(4 + r() * 5).toFixed(1)}"` : ''}/>`,
        );
      }
      el.push(`<circle cx="${cx}" cy="${cy}" r="3.4" fill="${p.ink}"/>`);
    } else if (type === 'barrier') {
      // A gate of uneven columns — structure standing in the way.
      const n = 5 + Math.floor(r() * 2);
      const gap = 100 / (n + 1);
      for (let i = 1; i <= n; i++) {
        const w = 6 + r() * 5;
        const h = 34 + r() * 34;
        el.push(
          `<rect x="${(i * gap - w / 2).toFixed(1)}" y="${(92 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2.2" fill="${i % 2 ? p.a : p.b}" opacity="${(0.75 + r() * 0.25).toFixed(2)}"/>`,
        );
      }
      el.push(`<rect x="6" y="90" width="88" height="3.2" rx="1.6" fill="${p.ink}" opacity="0.8"/>`);
    } else if (type === 'vice') {
      // Hazard weave — diagonal strokes with a fracture through them.
      for (let i = -2; i < 8; i++) {
        const x = i * 16 + r() * 5;
        el.push(
          `<line x1="${x}" y1="100" x2="${x + 34}" y2="0" stroke="${i % 2 ? p.b : p.a}" stroke-width="${(4 + r() * 3).toFixed(1)}" opacity="${(0.5 + r() * 0.3).toFixed(2)}"/>`,
        );
      }
      const fy = 34 + r() * 24;
      el.push(
        `<polyline points="8,${fy.toFixed(0)} 34,${(fy + 10).toFixed(0)} 52,${(fy - 8).toFixed(0)} 72,${(fy + 12).toFixed(0)} 94,${(fy + 2).toFixed(0)}" fill="none" stroke="${p.ink}" stroke-width="2.6" stroke-linejoin="round"/>`,
      );
    } else {
      // Culture: a loose ring of gathered dots — community around a centre.
      const cx = 50;
      const cy = 55;
      for (let i = 0; i < 26; i++) {
        const ang = r() * Math.PI * 2;
        const dist = 16 + r() * 26;
        el.push(
          `<circle cx="${(cx + Math.cos(ang) * dist).toFixed(1)}" cy="${(cy + Math.sin(ang) * dist * 0.72).toFixed(1)}" r="${(1.6 + r() * 2.6).toFixed(1)}" fill="${r() > 0.5 ? p.a : p.b}" opacity="${(0.45 + r() * 0.5).toFixed(2)}"/>`,
        );
      }
      el.push(`<circle cx="${cx}" cy="${cy}" r="4.6" fill="${p.ink}"/>`);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-hidden="true">${el.join('')}</svg>`;
  }, [type, seed]);

  // Safe by construction: the SVG string is assembled purely from our own
  // numeric output — no external or user-supplied content ever enters it.
  return <span className="block h-full w-full" dangerouslySetInnerHTML={{ __html: art }} />;
}
