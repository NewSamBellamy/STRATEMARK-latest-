/**
 * Deterministic per-company dashboard content generator. Guarantees every
 * company opens a fully-populated 8-tab dashboard (spec §8) — no gaps — while
 * keeping the payloads shaped exactly like the back end will return them.
 */
import {
  type DashboardContentMap,
  type HistoryContent,
  type LiveIntelContent,
  type MaturityTier,
  type MetricsContent,
  type MissionGovernanceContent,
  type OverviewContent,
  type ProductsRoadmapContent,
  type RefreshCadence,
  type TeamOrgContent,
  TIER_LABELS,
} from '@mi/contracts';
import type { CompanySeed } from './seed';
import { ts } from './ids';

export interface ContentContext {
  seed: CompanySeed;
  tier: MaturityTier | null;
  arr: number | null;
  users: number | null;
  employees: number | null;
  cadence: RefreshCadence;
}

const fmtUsd = (n: number): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
};

function overview(ctx: ContentContext): OverviewContent {
  const { seed, tier, arr, employees } = ctx;
  const tierLine = tier ? `**${TIER_LABELS[tier]}** (Tier ${tier})` : 'Not tiered (non-company card)';
  const md = [
    `# ${seed.name}`,
    ``,
    `> ${seed.oneLiner}`,
    ``,
    `**HQ:** ${seed.hq}  •  **Maturity:** ${tierLine}`,
    ``,
    `## What they do`,
    `${seed.name} operates in the faith-apparel market from ${seed.hq}. ${seed.oneLiner} The company reaches its audience through a mix of direct-to-consumer channels, community partnerships, and (where applicable) wholesale distribution.`,
    ``,
    `## Snapshot`,
    `- **ARR:** ${arr != null ? fmtUsd(arr) : 'Unknown'}`,
    `- **Employees:** ${employees != null ? employees.toLocaleString() : 'Unknown'}`,
    `- **Website:** ${seed.website}`,
    ``,
    `## Why it matters`,
    `Positioned within the competitive set for this market, ${seed.name} is a useful reference point for understanding how brands at the ${tier ? TIER_LABELS[tier] : 'current'} stage compete on authenticity, distribution, and community trust.`,
    ``,
    `_Some figures on this page may be estimated from indirect signals rather than company-disclosed data — see the Metrics tab for per-figure confidence._`,
  ].join('\n');
  return { markdown: md };
}

function liveIntel(ctx: ContentContext): LiveIntelContent {
  const { seed, cadence } = ctx;
  const items: LiveIntelContent['items'] = [
    {
      id: `${seed.slug}-news-1`,
      source: 'news',
      title: `${seed.name} expands its California retail footprint`,
      url: `${seed.website}/news/expansion`,
      summary: `Trade coverage notes ${seed.name} is broadening distribution across California faith communities.`,
      sentiment: 'positive',
      publishedAt: ts(1),
      stale: false,
    },
    {
      id: `${seed.slug}-x-1`,
      source: 'x',
      title: `Buzz around ${seed.name}'s latest drop`,
      url: `https://x.com/search?q=${encodeURIComponent(seed.name)}`,
      summary: `Mixed reactions to the newest collection; fans praise design, some question pricing.`,
      sentiment: 'neutral',
      publishedAt: ts(2),
      stale: false,
    },
    {
      id: `${seed.slug}-reddit-1`,
      source: 'reddit',
      title: `r/ChristianApparel discusses ${seed.name} quality`,
      url: `https://reddit.com/r/ChristianApparel`,
      summary: `Community thread compares fabric quality and sizing against competitors.`,
      sentiment: 'positive',
      publishedAt: ts(4),
      stale: false,
    },
    {
      id: `${seed.slug}-news-2`,
      source: 'news',
      title: `Older report on ${seed.name} pricing strategy`,
      url: `${seed.website}/news/pricing`,
      summary: `A prior article whose figures have since been superseded by newer disclosures.`,
      sentiment: 'negative',
      publishedAt: ts(45),
      stale: true, // demonstrates the stale-prune indicator (spec §8, §9)
    },
  ];
  return { items, lastRefreshedAt: ts(0), cadence };
}

function teamOrg(ctx: ContentContext): TeamOrgContent {
  const { seed, tier } = ctx;
  const big = (tier ?? 1) >= 6;
  const nodes: TeamOrgContent['nodes'] = [
    { id: `${seed.slug}-ceo`, name: 'Jordan Rivera', role: 'Founder & CEO', group: 'exec', parentId: null, bio: 'Fixture bio: founded the label after a decade in apparel sourcing; the public face of the brand.' },
    { id: `${seed.slug}-coo`, name: 'Sam Okafor', role: 'COO', group: 'exec', parentId: `${seed.slug}-ceo`, bio: 'Fixture bio: runs operations and the wholesale channel.' },
    { id: `${seed.slug}-cpo`, name: 'Alex Nguyen', role: 'Head of Product', group: 'product', parentId: `${seed.slug}-ceo`, bio: 'Fixture bio: owns the product line and drop calendar.' },
    { id: `${seed.slug}-design`, name: 'Riley Brooks', role: 'Creative Director', group: 'design', parentId: `${seed.slug}-cpo`, bio: '' },
  ];
  if (big) {
    nodes.push(
      { id: `${seed.slug}-cto`, name: 'Priya Shah', role: 'CTO', group: 'exec', parentId: `${seed.slug}-ceo`, bio: 'Fixture bio: leads e-commerce engineering.' },
      { id: `${seed.slug}-ai`, name: 'Marcus Lee', role: 'Head of AI', group: 'ai', parentId: `${seed.slug}-cto`, bio: '' },
      { id: `${seed.slug}-data`, name: 'Dana Cruz', role: 'ML Engineer', group: 'ai', parentId: `${seed.slug}-ai`, bio: '' },
    );
  }
  return { nodes };
}

function liveLanding(ctx: ContentContext): DashboardContentMap['live_landing'] {
  const { seed } = ctx;
  // Deterministically mark ~1/3 of sites as non-embeddable to exercise the
  // screenshot + link-out fallback (spec §8 [OPEN]).
  const embeddable = seed.slug.length % 3 !== 0;
  return {
    url: seed.website,
    embeddable,
    screenshotUrl: null,
  };
}

function metrics(ctx: ContentContext): MetricsContent {
  const { arr, users } = ctx;
  const periods = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
  const baseRev = (arr ?? 2_000_000) / 6;
  const revenue = periods.map((p, i) => ({ period: p, value: Math.round(baseRev * (0.7 + i * 0.1)) }));
  const baseUsers = users ?? 50_000;
  const usersSeries = periods.map((p, i) => ({
    period: p,
    value: Math.round(baseUsers * (0.6 + i * 0.09)),
  }));
  const churn = periods.map((p, i) => ({ period: p, value: Math.max(1.5, 6 - i * 0.6) }));
  const nps = periods.map((p, i) => ({ period: p, value: 30 + i * 4 }));
  const capTable = [
    { holder: 'Founders', pct: 45 },
    { holder: 'Seed investors', pct: 18 },
    { holder: 'Series A/B', pct: 22 },
    { holder: 'Employee pool', pct: 15 },
  ];
  return { revenue, users: usersSeries, churn, nps, capTable };
}

function missionGovernance(ctx: ContentContext): MissionGovernanceContent {
  const { seed } = ctx;
  return {
    mission: `${seed.name} exists to make faith expressible through everyday apparel with integrity and craftsmanship.`,
    ethos: `The company frames its work around authenticity, community reinvestment, and ethical production.`,
    governanceStructure: `Founder-led board with independent directors overseeing sourcing ethics and brand integrity.`,
    board: [
      { name: 'Jordan Rivera', affiliation: 'Founder & CEO' },
      { name: 'Rev. Michael Ann Torres', affiliation: 'Independent Director, Ministry Partnerships' },
      { name: 'Elaine Sørensen', affiliation: 'Independent Director, Ethical Sourcing' },
    ],
    positives: [
      seed.cultureNote ?? 'Publishes an annual ethical-sourcing report.',
      'Partners with California-based community ministries.',
    ],
    negatives: seed.viceClaims?.length
      ? ['Subject to public criticism/litigation — see the Vice card for sourced claims.']
      : ['No major governance concerns surfaced in current research.'],
  };
}

function history(ctx: ContentContext): HistoryContent {
  const { seed } = ctx;
  return {
    founderStory: `${seed.name} was founded when its team saw a gap between mass-market faith merch and design-forward apparel. Starting from ${seed.hq}, they built a brand around ${seed.oneLiner.toLowerCase()}`,
    timeline: [
      { date: '2019', title: 'Founded', detail: `${seed.name} established in ${seed.hq}.` },
      { date: '2021', title: 'First major launch', detail: 'Flagship collection released to strong community response.' },
      { date: '2023', title: 'Channel expansion', detail: 'Added wholesale and marketplace distribution.' },
      { date: '2025', title: 'Scale milestone', detail: 'Crossed a significant revenue and audience threshold.' },
    ],
    quotes: [
      { text: 'We want the garment to start a conversation, not end one.', attribution: 'Jordan Rivera, CEO' },
      { text: 'Authenticity is the whole product.', attribution: 'Riley Brooks, Creative Director' },
    ],
  };
}

function productsRoadmap(ctx: ContentContext): ProductsRoadmapContent {
  const { seed } = ctx;
  return {
    products: [
      { name: 'Core Tees', description: 'Everyday scripture-graphic tees.', status: 'live', revenueNote: 'Fixture: the volume line — majority of unit sales.' },
      { name: 'Activewear Line', description: 'Performance apparel for faith communities.', status: 'live', revenueNote: 'Fixture: growing second line.' },
      { name: 'Limited Drops', description: 'Seasonal collaborations and capsule releases.', status: 'beta', revenueNote: 'Fixture: not disclosed.' },
      { name: 'Legacy Hoodies v1', description: 'First-generation hoodie line.', status: 'sunset', revenueNote: 'Fixture: wound down.' },
    ],
    roadmap: [
      { title: 'Loyalty & community app', horizon: 'now', detail: `${seed.name} is investing in a members app.` },
      { title: 'Sustainable fabric program', horizon: 'next', detail: 'Transition core line to certified materials.' },
      { title: 'International expansion', horizon: 'later', detail: 'Explore distribution beyond the US.' },
    ],
  };
}

export function generateDashboardContent(ctx: ContentContext): DashboardContentMap {
  return {
    overview: overview(ctx),
    live_intel: liveIntel(ctx),
    team_org: teamOrg(ctx),
    live_landing: liveLanding(ctx),
    metrics: metrics(ctx),
    mission_governance: missionGovernance(ctx),
    history: history(ctx),
    products_roadmap: productsRoadmap(ctx),
  };
}
