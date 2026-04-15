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

export type NodeRunMode =
  | "manual"
  | "event-triggered"
  | "scheduled"
  | "continuous";
export type LoggingLevel = "basic" | "verbose" | "debug";
export type ExecutionEnvironment = "paper" | "sandbox" | "live";
export type AllowedDataScope = "own-workspace" | "shared" | "public";

/** Shared knobs available on all node settings. */
export interface CommonNodeSettings {
  nodeName?: string;
  description?: string;
  enabled: boolean;
  tags: string[];
  runMode: NodeRunMode;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  maxConcurrentRuns: number;
  cooldownMs: number;
  streaming: boolean;
  loggingLevel: LoggingLevel;
  emitIntermediateSteps: boolean;
  useConversationHistory: boolean;
  useSharedGraphState: boolean;
  useNodeLocalMemory: boolean;
  memoryWindowSize: number;
  contextCompression: boolean;
  includePreviousConnectedOutputs: boolean;
  persistOutputs: boolean;
  requireHumanApproval: boolean;
  approvalThreshold: number;
  blockOnError: boolean;
  maxTokenBudget?: number;
  maxCostBudgetUsd?: number;
  allowedEnvironments: ExecutionEnvironment[];
  allowedDataScope: AllowedDataScope;
  secretAccessAllowed: boolean;
  showLiveStatus: boolean;
  showOutputPreview: boolean;
  showReasoningSummary: boolean;
  collapseByDefault: boolean;
  displayMetricsOnCard: boolean;
}

export interface SupervisorConfig extends CommonNodeSettings {
  objective: string;
  rolePrompt: string;
  systemInstruction: string;
  delegationMode: "disabled" | "selective" | "aggressive";
  provider: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  reasoningLevel: "low" | "medium" | "high";
  toolCallingEnabled: boolean;
  structuredOutputMode: boolean;
  responseStyle: "concise" | "balanced" | "detailed";
  allowedSubagents: Array<"researcher" | "monitor" | "strategist">;
  maxSubagentDepth: number;
  maxSubagentCountPerRun: number;
  parallelDelegation: boolean;
  mergeStrategy: "summarize" | "compare" | "vote" | "priority-based";
  routingStrategy: "rule-based" | "model-based" | "hybrid";
  maxStepsPerRun: number;
  canCallTrader: boolean;
  canCallWallet: boolean;
  requiresApprovalBeforeLiveExecution: boolean;
  liveTradingEnabled: boolean;
  maxNotionalPerAction?: number;
  globalDrawdownStop?: number;
}

export interface ResearcherConfig extends CommonNodeSettings {
  topics: string;
  instruction: string;
  outputFormat: "json" | "text";
  assetsSymbols: string[];
  keywords: string[];
  sources: Array<"x" | "news" | "docs" | "on-chain" | "forums" | "custom-api">;
  timeHorizon: "intraday" | "daily" | "swing" | "macro";
  maxSourcesPerRun: number;
  recencyWindowHours: number;
  sentimentExtraction: boolean;
  contradictionDetection: boolean;
  requireCitations: boolean;
  blockUntrustedDomains: boolean;
}

export interface MonitorConfig extends CommonNodeSettings {
  chain: string;
  walletAddress?: string;
  tokenId?: string;
  monitorTransactions: boolean;
  monitorKlines: boolean;
  monitorPriceChange: boolean;
  monitorWallet: boolean;
  monitorToken: boolean;
  pollIntervalSec: number;
  symbols: string[];
  monitorPnl: boolean;
  monitorVolatility: boolean;
  monitorApiHealth: boolean;
  percentMoveThreshold?: number;
  drawdownThreshold?: number;
  gainThreshold?: number;
  errorCountThreshold?: number;
  mode: "polling" | "websocket";
  alwaysOn: boolean;
  alertOnly: boolean;
  sendToSupervisor: boolean;
  triggerStrategist: boolean;
  pauseTrader: boolean;
  alertCondition: "price-threshold" | "change-threshold" | "transaction-spike" | "custom";
  alertInstruction: string;
}

export interface StrategistConfig extends CommonNodeSettings {
  riskNotes: string;
  improveWithSupervisorFeedback: boolean;
  requiresSupervisorApproval: boolean;
  passToTraderOnApproval: boolean;
  strategyType:
    | "trend"
    | "mean-reversion"
    | "breakout"
    | "sentiment"
    | "market-making"
    | "custom";
  timeframe: string;
  symbols: string[];
  positionStyle: "scalp" | "intraday" | "swing";
  longShortMode: "long-only" | "short-only" | "both";
  useResearchOutput: boolean;
  useMonitorState: boolean;
  useSentiment: boolean;
  usePortfolioExposure: boolean;
  useWalletBalance: boolean;
  riskRewardMin: number;
  confidenceThreshold: number;
  maxSimultaneousIdeas: number;
  entryCriteria: string;
  exitCriteria: string;
  stopLossRule: string;
  takeProfitRule: string;
  cannotExecuteTradesDirectly: true;
}

export interface TraderConfig extends CommonNodeSettings {
  chain: string;
  assetsId: string;
  inTokenAddress: string;
  outTokenAddress: string;
  inAmount: string;
  swapType: "buy" | "sell";
  slippageBps: string;
  useMev: boolean;
  strictStrategyExecution: boolean;
  strategySource: "strategist-approved" | "manual";
  allowedSymbols: string[];
  allowedOrderTypes: Array<"market" | "limit">;
  maxOrderSize?: string;
  maxNotional?: string;
  requireApprovalBeforeLiveOrders: boolean;
  dailyTradeLimit?: number;
  maxOpenPositions?: number;
  validateBalanceBeforeOrder: boolean;
  validateRiskBeforeOrder: boolean;
  validateMarketStatus: boolean;
  validateSymbolWhitelist: boolean;
  validateDuplicateOrderPrevention: boolean;
  returnExecutionReport: boolean;
}

export interface WalletConfig extends CommonNodeSettings {
  assetsName: string;
  walletProvider: string;
  autonomousTradingEnabled: boolean;
  proxyWalletEnabled: boolean;
  walletAddress?: string;
  chainNetwork: string;
  custodyMode: "read-only" | "signer" | "delegated-signer";
  readBalance: boolean;
  readPositions: boolean;
  readTransactionHistory: boolean;
  transferFunds: boolean;
  approveTokenSpend: boolean;
  signTransaction: boolean;
  revokeApprovals: boolean;
  allowedTokens: string[];
  allowedDestinations: string[];
  maxTransferAmount?: string;
  dailyTransferCap?: string;
  requireTransferApproval: boolean;
  cooldownAfterTransferSec: number;
  maxGasFee?: string;
  showBalancesOnNodeCard: boolean;
}

export interface ToolConfig extends CommonNodeSettings {
  toolId: string;
  platform: string;
  apiBaseUrl: string;
  apiKeyRef?: string;
  mcpEndpoint: string;
  mcpServerId?: string;
  transport: "http" | "stdio" | "sse";
}

export interface AgentNodeConfigByType {
  supervisor: SupervisorConfig;
  researcher: ResearcherConfig;
  monitor: MonitorConfig;
  strategist: StrategistConfig;
  trader: TraderConfig;
  wallet: WalletConfig;
  tool: ToolConfig;
}

export type NodeDataConfig = {
  [K in AgentNodeType]: { type: K; config: AgentNodeConfigByType[K] };
}[AgentNodeType];

export interface FlowGraphPayload {
  nodes: Node[];
  edges: Edge[];
}
