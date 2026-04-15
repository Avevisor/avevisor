import type { Edge, Node } from "@xyflow/react";

import type { AgentNodeType } from "@/lib/node-schema/types";

const defaultPosition = (index: number) => ({
  x: 80 + (index % 3) * 220,
  y: 80 + Math.floor(index / 3) * 140,
});

function makeNode(
  id: string,
  nodeType: AgentNodeType,
  label: string,
  index: number,
  config: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: "agent",
    position: defaultPosition(index),
    data: {
      label,
      nodeType,
      config,
    },
  };
}

/**
 * Seeded demo graph: Supervisor → Researcher, Monitor → Strategist → Trader + Tool.
 */
export function getSeededFlowTemplate(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    makeNode("n-supervisor", "supervisor", "Supervisor", 0, {
      objective: "Coordinate AVE trading workflow",
    }),
    makeNode("n-researcher", "researcher", "Researcher", 1, {
      topics: "Token fundamentals, social, docs",
    }),
    makeNode("n-monitor", "monitor", "Monitor", 2, {
      chain: "solana",
      walletAddress: "",
      tokenId: "",
    }),
    makeNode("n-strategist", "strategist", "Strategist", 3, {
      riskNotes: "Conservative sizing",
    }),
    makeNode("n-trader", "trader", "Trader", 4, {
      chain: "solana",
      assetsId: "",
      inTokenAddress: "sol",
      outTokenAddress: "",
      inAmount: "1000000",
      swapType: "buy",
      slippageBps: "500",
      useMev: false,
    }),
    makeNode("n-wallet", "wallet", "Wallet", 5, {
      assetsName: "demo-delegate",
    }),
    makeNode("n-tool", "tool", "X API", 6, {
      toolId: "x-api",
    }),
  ];

  const edges: Edge[] = [
    { id: "e1", source: "n-supervisor", target: "n-researcher" },
    { id: "e2", source: "n-supervisor", target: "n-monitor" },
    { id: "e3", source: "n-researcher", target: "n-strategist" },
    { id: "e4", source: "n-monitor", target: "n-strategist" },
    { id: "e5", source: "n-strategist", target: "n-trader" },
    { id: "e6", source: "n-supervisor", target: "n-tool" },
  ];

  return { nodes, edges };
}

export const FLOW_STORAGE_KEY = "avevisor-flow-v1";
