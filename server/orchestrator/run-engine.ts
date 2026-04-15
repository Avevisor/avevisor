import type { Edge, Node } from "@xyflow/react";

import { parseAgentNodeType } from "@/lib/node-schema/validation";
import { getDataApiKey, getDelegateCredentials } from "@/server/env";
import { getTokenDetail, getTokenKlines, getWalletInfo } from "@/server/integrations/ave/data-api";
import { sendSwapOrder } from "@/server/integrations/ave/delegate-trade";
import { generateWallet } from "@/server/integrations/ave/delegate-user";
import { runHermesRole } from "@/server/integrations/hermes/runner";
import { waitForBotswapOrder } from "@/server/realtime/botswap-listener";
import {
  assertTraderAllowed,
  defaultExecutionPolicy,
  type ExecutionPolicy,
} from "./guardrails";

export interface NodeRunLogEntry {
  nodeId: string;
  nodeType: string;
  status: "ok" | "error" | "skipped";
  output?: unknown;
  error?: string;
  startedAt: string;
  endedAt: string;
}

export interface RunResult {
  runId: string;
  logs: NodeRunLogEntry[];
  summary?: unknown;
}

function nowIso() {
  return new Date().toISOString();
}

function getNodeType(n: Node): string | null {
  const raw = (n.data as { nodeType?: string } | undefined)?.nodeType;
  return parseAgentNodeType(raw) ?? null;
}

function getConfig<T>(n: Node): T {
  return ((n.data as { config?: T })?.config ?? {}) as T;
}

/**
 * Executes the flow: Monitor → Researcher → Strategist → Hermes supervisor pass → Trader/Wallet.
 */
export async function executeFlow(params: {
  runId: string;
  nodes: Node[];
  /** Reserved for future DAG ordering; MVP uses fixed phases. */
  edges: Edge[];
  objective?: string;
  dryRun?: boolean;
  confirmLive?: boolean;
  policy?: ExecutionPolicy;
}): Promise<RunResult> {
  void params.edges;
  const logs: NodeRunLogEntry[] = [];
  const policy: ExecutionPolicy = {
    ...defaultExecutionPolicy,
    ...params.policy,
    dryRun: params.dryRun ?? defaultExecutionPolicy.dryRun,
  };

  const delegate = getDelegateCredentials();
  const dataKey = getDataApiKey();

  const byType = (t: string) =>
    params.nodes.filter((n) => getNodeType(n) === t);

  const monitorNodes = byType("monitor");
  const researcherNodes = byType("researcher");
  const strategistNodes = byType("strategist");
  const traderNodes = byType("trader");
  const walletNodes = byType("wallet");
  const toolNodes = byType("tool");

  let monitorBundle: unknown = {};
  let researchBundle: unknown = {};
  let strategyBundle: unknown = {};

  /** Monitor phase */
  for (const n of monitorNodes) {
    const startedAt = nowIso();
    try {
      if (!dataKey) {
        logs.push({
          nodeId: n.id,
          nodeType: "monitor",
          status: "skipped",
          error: "AVE_DATA_API_KEY not configured",
          startedAt,
          endedAt: nowIso(),
        });
        continue;
      }
      const cfg = getConfig<{
        chain: string;
        walletAddress?: string;
        tokenId?: string;
      }>(n);
      const parts: Record<string, unknown> = { chain: cfg.chain };
      if (cfg.walletAddress) {
        parts.wallet = await getWalletInfo({
          apiKey: dataKey,
          walletAddress: cfg.walletAddress,
          chain: cfg.chain,
        });
      }
      if (cfg.tokenId) {
        parts.token = await getTokenDetail({ apiKey: dataKey, tokenId: cfg.tokenId });
        parts.klines = await getTokenKlines({
          apiKey: dataKey,
          tokenId: cfg.tokenId,
          interval: 5,
          limit: 48,
        });
      }
      monitorBundle = { ...monitorBundle as object, [n.id]: parts };
      const sub = await runHermesRole({
        role: "monitor",
        userPrompt: params.objective ?? "Summarize monitor output.",
        contextJson: parts,
      });
      logs.push({
        nodeId: n.id,
        nodeType: "monitor",
        status: "ok",
        output: { data: parts, hermes: sub },
        startedAt,
        endedAt: nowIso(),
      });
    } catch (e) {
      logs.push({
        nodeId: n.id,
        nodeType: "monitor",
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        startedAt,
        endedAt: nowIso(),
      });
    }
  }

  /** Researcher phase */
  for (const n of researcherNodes) {
    const startedAt = nowIso();
    try {
      const cfg = getConfig<{ topics?: string }>(n);
      const sub = await runHermesRole({
        role: "researcher",
        userPrompt: cfg.topics ?? params.objective ?? "Research context.",
        contextJson: { monitor: monitorBundle },
      });
      researchBundle = { ...researchBundle as object, [n.id]: sub.text };
      logs.push({
        nodeId: n.id,
        nodeType: "researcher",
        status: "ok",
        output: sub,
        startedAt,
        endedAt: nowIso(),
      });
    } catch (e) {
      logs.push({
        nodeId: n.id,
        nodeType: "researcher",
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        startedAt,
        endedAt: nowIso(),
      });
    }
  }

  /** Strategist phase */
  for (const n of strategistNodes) {
    const startedAt = nowIso();
    try {
      const sub = await runHermesRole({
        role: "strategist",
        userPrompt: params.objective ?? "Propose strategy.",
        contextJson: { monitor: monitorBundle, research: researchBundle },
      });
      strategyBundle = { ...strategyBundle as object, [n.id]: sub.text };
      logs.push({
        nodeId: n.id,
        nodeType: "strategist",
        status: "ok",
        output: sub,
        startedAt,
        endedAt: nowIso(),
      });
    } catch (e) {
      logs.push({
        nodeId: n.id,
        nodeType: "strategist",
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        startedAt,
        endedAt: nowIso(),
      });
    }
  }

  /** Supervisor synthesis */
  const sup = params.nodes.find((n) => getNodeType(n) === "supervisor");
  if (sup) {
    const startedAt = nowIso();
    try {
      const sub = await runHermesRole({
        role: "supervisor",
        userPrompt: params.objective ?? "Coordinate subagents and approve next step.",
        contextJson: {
          monitor: monitorBundle,
          research: researchBundle,
          strategy: strategyBundle,
          tools: toolNodes.map((t) => ({
            id: t.id,
            config: getConfig(t),
          })),
        },
      });
      logs.push({
        nodeId: sup.id,
        nodeType: "supervisor",
        status: "ok",
        output: sub,
        startedAt,
        endedAt: nowIso(),
      });
    } catch (e) {
      logs.push({
        nodeId: sup.id,
        nodeType: "supervisor",
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        startedAt,
        endedAt: nowIso(),
      });
    }
  }

  /** Wallet node: generate delegate wallet (optional) */
  for (const n of walletNodes) {
    const startedAt = nowIso();
    try {
      if (!delegate) {
        logs.push({
          nodeId: n.id,
          nodeType: "wallet",
          status: "skipped",
          error: "AVE_ACCESS_KEY / AVE_SECRET_KEY missing",
          startedAt,
          endedAt: nowIso(),
        });
        continue;
      }
      const cfg = getConfig<{ assetsName?: string }>(n);
      const name = cfg.assetsName ?? `flow-${params.runId.slice(0, 8)}`;
      const data = await generateWallet({
        credentials: delegate,
        assetsName: name,
      });
      logs.push({
        nodeId: n.id,
        nodeType: "wallet",
        status: "ok",
        output: data,
        startedAt,
        endedAt: nowIso(),
      });
    } catch (e) {
      logs.push({
        nodeId: n.id,
        nodeType: "wallet",
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        startedAt,
        endedAt: nowIso(),
      });
    }
  }

  /** Trader nodes */
  for (const n of traderNodes) {
    const startedAt = nowIso();
    try {
      const cfg = getConfig<{
        chain: string;
        assetsId: string;
        inTokenAddress: string;
        outTokenAddress: string;
        inAmount: string;
        swapType: "buy" | "sell";
        slippageBps: string;
        useMev: boolean;
      }>(n);

      const isDryRun = policy.dryRun || params.dryRun === true;
      if (!isDryRun) {
        assertTraderAllowed({
          policy,
          chain: cfg.chain,
          inTokenAddress: cfg.inTokenAddress,
          outTokenAddress: cfg.outTokenAddress,
          inAmount: cfg.inAmount,
          userConfirmedLive: params.confirmLive === true,
        });
      }

      if (isDryRun) {
        logs.push({
          nodeId: n.id,
          nodeType: "trader",
          status: "ok",
          output: {
            dryRun: true,
            wouldSubmit: cfg,
          },
          startedAt,
          endedAt: nowIso(),
        });
        continue;
      }

      if (!delegate) {
        logs.push({
          nodeId: n.id,
          nodeType: "trader",
          status: "error",
          error: "Delegate credentials missing for live trade",
          startedAt,
          endedAt: nowIso(),
        });
        continue;
      }

      const swapRes = await sendSwapOrder({
        credentials: delegate,
        body: {
          chain: cfg.chain,
          assetsId: cfg.assetsId,
          inTokenAddress: cfg.inTokenAddress,
          outTokenAddress: cfg.outTokenAddress,
          inAmount: cfg.inAmount,
          swapType: cfg.swapType,
          slippage: cfg.slippageBps,
          useMev: cfg.useMev,
        },
      });

      const rawId = swapRes.data as { id?: string } | Array<{ id?: string }>;
      const orderId = Array.isArray(rawId)
        ? rawId[0]?.id
        : rawId?.id;

      let botswap: unknown = null;
      if (orderId) {
        try {
          botswap = await waitForBotswapOrder({
            accessKey: delegate.accessKey,
            orderId,
            timeoutMs: 90_000,
          });
        } catch {
          botswap = { note: "botswap wait failed or timed out; check AVE console." };
        }
      }

      logs.push({
        nodeId: n.id,
        nodeType: "trader",
        status: "ok",
        output: { swap: swapRes, botswap },
        startedAt,
        endedAt: nowIso(),
      });
    } catch (e) {
      logs.push({
        nodeId: n.id,
        nodeType: "trader",
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        startedAt,
        endedAt: nowIso(),
      });
    }
  }

  /** Tool nodes — logged as passthrough for MCP (no network in MVP) */
  for (const n of toolNodes) {
    logs.push({
      nodeId: n.id,
      nodeType: "tool",
      status: "ok",
      output: {
        note: "Connect MCP server in production; config only in MVP.",
        config: getConfig(n),
      },
      startedAt: nowIso(),
      endedAt: nowIso(),
    });
  }

  return {
    runId: params.runId,
    logs,
    summary: {
      monitor: monitorBundle,
      research: researchBundle,
      strategy: strategyBundle,
    },
  };
}
