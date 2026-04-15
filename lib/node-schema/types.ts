import type { Edge, Node } from "@xyflow/react";

/** Supported canvas node roles for the AVE agent MVP. */
export type AgentNodeType =
  | "supervisor"
  | "researcher"
  | "monitor"
  | "strategist"
  | "trader"
  | "wallet"
  | "tool";

export interface SupervisorConfig {
  objective?: string;
}

export interface ResearcherConfig {
  topics?: string;
}

export interface MonitorConfig {
  chain: string;
  walletAddress?: string;
  tokenId?: string;
  pollIntervalSec?: number;
}

export interface StrategistConfig {
  riskNotes?: string;
}

export interface TraderConfig {
  chain: string;
  assetsId: string;
  inTokenAddress: string;
  outTokenAddress: string;
  inAmount: string;
  swapType: "buy" | "sell";
  slippageBps: string;
  useMev: boolean;
}

export interface WalletConfig {
  assetsName?: string;
}

export interface ToolConfig {
  toolId: string;
  mcpEndpoint?: string;
}

export type NodeDataConfig =
  | { type: "supervisor"; config: SupervisorConfig }
  | { type: "researcher"; config: ResearcherConfig }
  | { type: "monitor"; config: MonitorConfig }
  | { type: "strategist"; config: StrategistConfig }
  | { type: "trader"; config: TraderConfig }
  | { type: "wallet"; config: WalletConfig }
  | { type: "tool"; config: ToolConfig };

export interface FlowGraphPayload {
  nodes: Node[];
  edges: Edge[];
}
