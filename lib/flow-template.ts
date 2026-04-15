import type { Edge, Node } from "@xyflow/react";

import type { AgentNodeType } from "@/lib/node-schema/types";

/** Stable id so reset/hydration always refers to the same Supervisor node. */
export const SUPERVISOR_NODE_ID = "n-supervisor";

function makeNode(
  id: string,
  nodeType: AgentNodeType,
  label: string,
  position: { x: number; y: number },
  config: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: "agent",
    position,
    data: {
      label,
      nodeType,
      config,
    },
  };
}

/**
 * Default empty-ish canvas: one fixed Supervisor only (user adds other nodes from the palette).
 */
export function getDefaultFlowTemplate(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    makeNode(SUPERVISOR_NODE_ID, "supervisor", "Supervisor", { x: 280, y: 160 }, {
      objective: "Coordinate AVE trading workflow",
    }),
  ];
  return { nodes, edges: [] };
}

/**
 * @deprecated Use getDefaultFlowTemplate — kept for any import compatibility.
 */
export function getSeededFlowTemplate(): { nodes: Node[]; edges: Edge[] } {
  return getDefaultFlowTemplate();
}

/** Bump when default canvas shape changes (e.g. v1 had full demo graph). */
export const FLOW_STORAGE_KEY = "avevisor-flow-v2";
