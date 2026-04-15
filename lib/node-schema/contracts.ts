import { z } from "zod";

import type {
  AgentNodeConfigByType,
  AgentNodeType,
  ExecutionEnvironment,
  LoggingLevel,
  NodeRunMode,
} from "./types";

const nodeRunModeSchema = z.enum([
  "manual",
  "event-triggered",
  "scheduled",
  "continuous",
]);

const loggingLevelSchema = z.enum(["basic", "verbose", "debug"]);
const executionEnvironmentSchema = z.enum(["paper", "sandbox", "live"]);

const commonSettingsSchema = z.object({
  nodeName: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  runMode: nodeRunModeSchema.default("manual"),
  timeoutMs: z.number().int().nonnegative().default(90_000),
  retryCount: z.number().int().nonnegative().default(1),
  retryDelayMs: z.number().int().nonnegative().default(1_000),
  maxConcurrentRuns: z.number().int().positive().default(1),
  cooldownMs: z.number().int().nonnegative().default(0),
  streaming: z.boolean().default(false),
  loggingLevel: loggingLevelSchema.default("basic"),
  emitIntermediateSteps: z.boolean().default(false),
  useConversationHistory: z.boolean().default(true),
  useSharedGraphState: z.boolean().default(true),
  useNodeLocalMemory: z.boolean().default(false),
  memoryWindowSize: z.number().int().positive().default(10),
  contextCompression: z.boolean().default(true),
  includePreviousConnectedOutputs: z.boolean().default(true),
  persistOutputs: z.boolean().default(true),
  requireHumanApproval: z.boolean().default(false),
  approvalThreshold: z.number().min(0).max(1).default(0.8),
  blockOnError: z.boolean().default(true),
  maxTokenBudget: z.number().int().positive().optional(),
  maxCostBudgetUsd: z.number().positive().optional(),
  allowedEnvironments: z.array(executionEnvironmentSchema).default(["paper"]),
  allowedDataScope: z.enum(["own-workspace", "shared", "public"]).default("own-workspace"),
  secretAccessAllowed: z.boolean().default(false),
  showLiveStatus: z.boolean().default(true),
  showOutputPreview: z.boolean().default(true),
  showReasoningSummary: z.boolean().default(false),
  collapseByDefault: z.boolean().default(false),
  displayMetricsOnCard: z.boolean().default(false),
});

const supervisorSettingsSchema = commonSettingsSchema.extend({
  objective: z.string().default("Coordinate AVE trading workflow"),
  rolePrompt: z.string().default("You are the Supervisor for AVE node workflows."),
  systemInstruction: z.string().default("Delegate, synthesize, and enforce safety constraints."),
  delegationMode: z.enum(["disabled", "selective", "aggressive"]).default("selective"),
  provider: z.string().default("hermes"),
  modelName: z.string().default("hermes"),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().positive().default(1200),
  reasoningLevel: z.enum(["low", "medium", "high"]).default("medium"),
  toolCallingEnabled: z.boolean().default(true),
  structuredOutputMode: z.boolean().default(true),
  responseStyle: z.enum(["concise", "balanced", "detailed"]).default("balanced"),
  allowedSubagents: z.array(z.enum(["researcher", "monitor", "strategist"])).default([
    "researcher",
    "monitor",
    "strategist",
  ]),
  maxSubagentDepth: z.number().int().positive().default(1),
  maxSubagentCountPerRun: z.number().int().positive().default(3),
  parallelDelegation: z.boolean().default(true),
  mergeStrategy: z.enum(["summarize", "compare", "vote", "priority-based"]).default("summarize"),
  routingStrategy: z.enum(["rule-based", "model-based", "hybrid"]).default("hybrid"),
  maxStepsPerRun: z.number().int().positive().default(8),
  canCallTrader: z.boolean().default(true),
  canCallWallet: z.boolean().default(false),
  requiresApprovalBeforeLiveExecution: z.boolean().default(true),
  liveTradingEnabled: z.boolean().default(false),
  maxNotionalPerAction: z.number().positive().optional(),
  globalDrawdownStop: z.number().positive().optional(),
});

const researcherSettingsSchema = commonSettingsSchema.extend({
  topics: z.string().default("Token fundamentals, social, docs"),
  assetsSymbols: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  sources: z.array(z.enum(["x", "news", "docs", "on-chain", "forums", "custom-api"])).default([
    "docs",
    "news",
    "on-chain",
  ]),
  timeHorizon: z.enum(["intraday", "daily", "swing", "macro"]).default("daily"),
  maxSourcesPerRun: z.number().int().positive().default(10),
  recencyWindowHours: z.number().int().positive().default(24),
  sentimentExtraction: z.boolean().default(true),
  contradictionDetection: z.boolean().default(true),
  requireCitations: z.boolean().default(true),
  blockUntrustedDomains: z.boolean().default(true),
});

const monitorSettingsSchema = commonSettingsSchema.extend({
  chain: z.string().default("solana"),
  walletAddress: z.string().optional(),
  tokenId: z.string().optional(),
  pollIntervalSec: z.number().int().positive().default(30),
  symbols: z.array(z.string()).default([]),
  monitorPnl: z.boolean().default(true),
  monitorVolatility: z.boolean().default(true),
  monitorApiHealth: z.boolean().default(true),
  percentMoveThreshold: z.number().positive().optional(),
  drawdownThreshold: z.number().positive().optional(),
  gainThreshold: z.number().positive().optional(),
  errorCountThreshold: z.number().int().positive().optional(),
  mode: z.enum(["polling", "websocket"]).default("polling"),
  alwaysOn: z.boolean().default(false),
  alertOnly: z.boolean().default(true),
  sendToSupervisor: z.boolean().default(true),
  triggerStrategist: z.boolean().default(false),
  pauseTrader: z.boolean().default(false),
});

const strategistSettingsSchema = commonSettingsSchema.extend({
  riskNotes: z.string().default("Conservative sizing"),
  strategyType: z
    .enum([
      "trend",
      "mean-reversion",
      "breakout",
      "sentiment",
      "market-making",
      "custom",
    ])
    .default("trend"),
  timeframe: z.string().default("1h"),
  symbols: z.array(z.string()).default([]),
  positionStyle: z.enum(["scalp", "intraday", "swing"]).default("intraday"),
  longShortMode: z.enum(["long-only", "short-only", "both"]).default("long-only"),
  useResearchOutput: z.boolean().default(true),
  useMonitorState: z.boolean().default(true),
  useSentiment: z.boolean().default(true),
  usePortfolioExposure: z.boolean().default(true),
  useWalletBalance: z.boolean().default(true),
  riskRewardMin: z.number().positive().default(1.5),
  confidenceThreshold: z.number().min(0).max(1).default(0.6),
  maxSimultaneousIdeas: z.number().int().positive().default(3),
  entryCriteria: z.string().default("Momentum confirmation + liquidity checks."),
  exitCriteria: z.string().default("Take-profit or stop-loss conditions reached."),
  stopLossRule: z.string().default("Hard stop at invalidation level."),
  takeProfitRule: z.string().default("Scale out into strength."),
  cannotExecuteTradesDirectly: z.literal(true).default(true),
});

const traderSettingsSchema = commonSettingsSchema.extend({
  chain: z.string().default("solana"),
  assetsId: z.string().default(""),
  inTokenAddress: z.string().default("sol"),
  outTokenAddress: z.string().default(""),
  inAmount: z.string().default("1000000"),
  swapType: z.enum(["buy", "sell"]).default("buy"),
  slippageBps: z.string().default("500"),
  useMev: z.boolean().default(false),
  allowedSymbols: z.array(z.string()).default([]),
  allowedOrderTypes: z.array(z.enum(["market", "limit"])).default(["market"]),
  maxOrderSize: z.string().optional(),
  maxNotional: z.string().optional(),
  requireApprovalBeforeLiveOrders: z.boolean().default(true),
  dailyTradeLimit: z.number().int().positive().optional(),
  maxOpenPositions: z.number().int().positive().optional(),
  validateBalanceBeforeOrder: z.boolean().default(true),
  validateRiskBeforeOrder: z.boolean().default(true),
  validateMarketStatus: z.boolean().default(true),
  validateSymbolWhitelist: z.boolean().default(true),
  validateDuplicateOrderPrevention: z.boolean().default(true),
  returnExecutionReport: z.boolean().default(true),
});

const walletSettingsSchema = commonSettingsSchema.extend({
  assetsName: z.string().default("demo-delegate"),
  walletProvider: z.string().default("ave-delegate"),
  walletAddress: z.string().optional(),
  chainNetwork: z.string().default("solana"),
  custodyMode: z.enum(["read-only", "signer", "delegated-signer"]).default("read-only"),
  readBalance: z.boolean().default(true),
  readPositions: z.boolean().default(true),
  readTransactionHistory: z.boolean().default(true),
  transferFunds: z.boolean().default(false),
  approveTokenSpend: z.boolean().default(false),
  signTransaction: z.boolean().default(false),
  revokeApprovals: z.boolean().default(false),
  allowedTokens: z.array(z.string()).default([]),
  allowedDestinations: z.array(z.string()).default([]),
  maxTransferAmount: z.string().optional(),
  dailyTransferCap: z.string().optional(),
  requireTransferApproval: z.boolean().default(true),
  cooldownAfterTransferSec: z.number().int().nonnegative().default(30),
  maxGasFee: z.string().optional(),
  showBalancesOnNodeCard: z.boolean().default(true),
});

const toolSettingsSchema = commonSettingsSchema.extend({
  toolId: z.string().default("x-api"),
  mcpEndpoint: z.string().default(""),
  mcpServerId: z.string().optional(),
  transport: z.enum(["http", "stdio", "sse"]).default("http"),
});

export const agentNodeConfigSchemaByType = {
  supervisor: supervisorSettingsSchema,
  researcher: researcherSettingsSchema,
  monitor: monitorSettingsSchema,
  strategist: strategistSettingsSchema,
  trader: traderSettingsSchema,
  wallet: walletSettingsSchema,
  tool: toolSettingsSchema,
} as const;

export type SupervisorSettings = z.infer<typeof supervisorSettingsSchema>;
export type ResearcherSettings = z.infer<typeof researcherSettingsSchema>;
export type MonitorSettings = z.infer<typeof monitorSettingsSchema>;
export type StrategistSettings = z.infer<typeof strategistSettingsSchema>;
export type TraderSettings = z.infer<typeof traderSettingsSchema>;
export type WalletSettings = z.infer<typeof walletSettingsSchema>;
export type ToolSettings = z.infer<typeof toolSettingsSchema>;

export function getDefaultNodeConfig<T extends AgentNodeType>(
  nodeType: T,
): AgentNodeConfigByType[T] {
  const schema = agentNodeConfigSchemaByType[nodeType];
  return schema.parse({}) as AgentNodeConfigByType[T];
}

export function coerceNodeConfig<T extends AgentNodeType>(
  nodeType: T,
  input: unknown,
): AgentNodeConfigByType[T] {
  const schema = agentNodeConfigSchemaByType[nodeType];
  return schema.parse(input ?? {}) as AgentNodeConfigByType[T];
}

export const nodeSettingsEnums = {
  nodeRunMode: nodeRunModeSchema.options as readonly NodeRunMode[],
  loggingLevel: loggingLevelSchema.options as readonly LoggingLevel[],
  executionEnvironment: executionEnvironmentSchema.options as readonly ExecutionEnvironment[],
};
