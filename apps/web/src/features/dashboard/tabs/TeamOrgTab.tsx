import { useMemo } from 'react';
import { ReactFlow, Background, Controls, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { OrgNode } from '@mi/contracts';
import { useCompany, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { useDeepDive } from '@/features/deepdive/DeepDive';

const GROUP_COLOR: Record<OrgNode['group'], string> = {
  exec: '#6366f1',
  ai: '#06b6d4',
  product: '#10b981',
  design: '#ec4899',
  other: '#64748b',
};

/** Simple layered tree layout: depth (distance from a root) → row, siblings spread across columns. */
function layout(nodes: OrgNode[]): { rfNodes: Node[]; rfEdges: Edge[] } {
  const depthOf = new Map<string, number>();
  const resolveDepth = (n: OrgNode): number => {
    if (depthOf.has(n.id)) return depthOf.get(n.id)!;
    if (!n.parentId) {
      depthOf.set(n.id, 0);
      return 0;
    }
    const parent = nodes.find((x) => x.id === n.parentId);
    const d = parent ? resolveDepth(parent) + 1 : 0;
    depthOf.set(n.id, d);
    return d;
  };
  nodes.forEach(resolveDepth);

  const perDepthCount = new Map<number, number>();
  const rfNodes: Node[] = nodes.map((n) => {
    const d = depthOf.get(n.id) ?? 0;
    const col = perDepthCount.get(d) ?? 0;
    perDepthCount.set(d, col + 1);
    return {
      id: n.id,
      position: { x: col * 220 + (d % 2) * 40, y: d * 130 },
      // Hover → the sourced 1-2 sentence bio (native tooltip); click → research.
      data: {
        label: (
          <span title={n.bio || `${n.name} — click to research this person`}>
            {n.name} · {n.role}
          </span>
        ),
      },
      style: {
        background: '#ffffff',
        color: '#18181B',
        border: `2px solid ${GROUP_COLOR[n.group]}`,
        borderRadius: 10,
        fontSize: 12,
        padding: 8,
        width: 190,
        boxShadow: '0 1px 2px rgba(17,17,26,0.06)',
      },
    };
  });

  const rfEdges: Edge[] = nodes
    .filter((n) => n.parentId)
    .map((n) => ({
      id: `${n.parentId}->${n.id}`,
      source: n.parentId as string,
      target: n.id,
      style: { stroke: '#D8D7D2' },
      animated: false,
    }));

  return { rfNodes, rfEdges };
}

export function TeamOrgTab({ companyId }: { companyId: string }) {
  const query = useDashboardTab(companyId, 'team_org');
  const graph = useMemo(() => layout(query.data?.content.nodes ?? []), [query.data]);
  const name = useCompany(companyId).data?.name ?? 'this company';
  const { chat } = useDeepDive();

  return (
    <QueryBoundary query={query} isEmpty={(r) => r.content.nodes.length === 0}>
      {(result) => (
        <div>
          <p className="mb-3 text-sm text-muted">
            Exec, AI, product, and design leadership. Hover a name for their reported background;
            click to research the person. Drag to explore; zoom with the controls.
          </p>
          <div className="panel h-[520px] overflow-hidden">
            <ReactFlow
              nodes={graph.rfNodes}
              edges={graph.rfEdges}
              fitView
              proOptions={{ hideAttribution: true }}
              nodesDraggable
              nodesConnectable={false}
              onNodeClick={(_, node) => {
                const person = result.content.nodes.find((n) => n.id === node.id);
                if (!person) return;
                chat(
                  { kind: 'datapoint', deckId: null, companyId, subject: person.name },
                  {
                    seed: `Who is ${person.name} (${person.role} at ${name})? Background, track record, and anything notable — grounded and sourced.`,
                  },
                );
              }}
            >
              <Background color="#E5E3DD" gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
            {Object.entries(GROUP_COLOR).map(([group, color]) => (
              <span key={group} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
                {group}
              </span>
            ))}
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}
