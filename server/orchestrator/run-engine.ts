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

type MonitorSentiment = "bullish" | "bearish" | "neutral";

interface MonitorHermesPayload {
  alerts: string[];
  sentiment: MonitorSentiment;
}

interface ResearcherHermesPayload {
  findings: string[];
  risks: string[];
  followUps: string[];
}

interface StrategistHermesPayload {
  thesis: string;
  actions: string[];
  riskControls: string[];
}

type TraderDecision = "execute" | "hold";

interface TraderHermesPayload {
  decision: TraderDecision;
  reason: string;
  checks: string[];
}

function tryParseJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through and try fenced JSON / object extraction.
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // Fall through and try brace extraction.
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function toMonitorHermesPayload(value: unknown): MonitorHermesPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { alerts?: unknown; sentiment?: unknown };
  if (
    !Array.isArray(candidate.alerts) ||
    !candidate.alerts.every((item) => typeof item === "string")
  ) {
    return null;
  }
  if (
    candidate.sentiment !== "bullish" &&
    candidate.sentiment !== "bearish" &&
    candidate.sentiment !== "neutral"
  ) {
    return null;
  }

  return {
    alerts: candidate.alerts,
    sentiment: candidate.sentiment,
  };
}

function parseMonitorHermesPayload(text: string): MonitorHermesPayload | null {
  const parsed = tryParseJsonObject(text);
  return toMonitorHermesPayload(parsed);
}

function toResearcherHermesPayload(value: unknown): ResearcherHermesPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    findings?: unknown;
    risks?: unknown;
    followUps?: unknown;
  };
  if (!Array.isArray(candidate.findings) || !candidate.findings.every((item) => typeof item === "string"))
    return null;
  if (!Array.isArray(candidate.risks) || !candidate.risks.every((item) => typeof item === "string"))
    return null;
  if (!Array.isArray(candidate.followUps) || !candidate.followUps.every((item) => typeof item === "string"))
    return null;

  return {
    findings: candidate.findings,
    risks: candidate.risks,
    followUps: candidate.followUps,
  };
}

function parseResearcherHermesPayload(text: string): ResearcherHermesPayload | null {
  const parsed = tryParseJsonObject(text);
  return toResearcherHermesPayload(parsed);
}

function toStrategistHermesPayload(value: unknown): StrategistHermesPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    thesis?: unknown;
    actions?: unknown;
    riskControls?: unknown;
  };
  if (typeof candidate.thesis !== "string" || !candidate.thesis.trim()) return null;
  if (!Array.isArray(candidate.actions) || !candidate.actions.every((item) => typeof item === "string"))
    return null;
  if (
    !Array.isArray(candidate.riskControls) ||
    !candidate.riskControls.every((item) => typeof item === "string")
  ) {
    return null;
  }

  return {
    thesis: candidate.thesis,
    actions: candidate.actions,
    riskControls: candidate.riskControls,
  };
}

function parseStrategistHermesPayload(text: string): StrategistHermesPayload | null {
  const parsed = tryParseJsonObject(text);
  return toStrategistHermesPayload(parsed);
}

function toTraderHermesPayload(value: unknown): TraderHermesPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { decision?: unknown; reason?: unknown; checks?: unknown };
  if (candidate.decision !== "execute" && candidate.decision !== "hold") return null;
  if (typeof candidate.reason !== "string" || !candidate.reason.trim()) return null;
  if (!Array.isArray(candidate.checks) || !candidate.checks.every((item) => typeof item === "string"))
    return null;

  return {
    decision: candidate.decision,
    reason: candidate.reason,
    checks: candidate.checks,
  };
}

function parseTraderHermesPayload(text: string): TraderHermesPayload | null {
  const parsed = tryParseJsonObject(text);
  return toTraderHermesPayload(parsed);
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
  let supervisorHermesText: string | undefined;

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
        runId: params.runId,
      });
      let finalSub = sub;
      let monitorPayload = parseMonitorHermesPayload(sub.text);
      let reparsed = false;

      if (!monitorPayload) {
        reparsed = true;
        const retrySub = await runHermesRole({
          role: "monitor",
          userPrompt:
            "Return STRICT JSON only with shape {\"alerts\": string[], \"sentiment\": \"bullish\"|\"bearish\"|\"neutral\"}. No markdown.",
          contextJson: {
            monitor: parts,
            previous_response: sub.text,
          },
          runId: params.runId,
        });
        finalSub = retrySub;
        monitorPayload = parseMonitorHermesPayload(retrySub.text);
      }

      const safeMonitorPayload: MonitorHermesPayload = monitorPayload ?? {
        alerts: ["Monitor response format invalid; using safe neutral fallback."],
        sentiment: "neutral",
      };

      logs.push({
        nodeId: n.id,
        nodeType: "monitor",
        status: "ok",
        output: {
          data: parts,
          hermes: {
            ...finalSub,
            parsed: safeMonitorPayload,
            validFormat: !!monitorPayload,
            reparsed,
          },
        },
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
        runId: params.runId,
      });
      let finalSub = sub;
      let researcherPayload = parseResearcherHermesPayload(sub.text);
      let reparsed = false;

      if (!researcherPayload) {
        reparsed = true;
        const retrySub = await runHermesRole({
          role: "researcher",
          userPrompt:
            "Return STRICT JSON only with shape {\"findings\": string[], \"risks\": string[], \"followUps\": string[]}. No markdown.",
          contextJson: {
            monitor: monitorBundle,
            previous_response: sub.text,
          },
          runId: params.runId,
        });
        finalSub = retrySub;
        researcherPayload = parseResearcherHermesPayload(retrySub.text);
      }

      const safeResearcherPayload: ResearcherHermesPayload = researcherPayload ?? {
        findings: ["Researcher response format invalid; no reliable findings extracted."],
        risks: ["Model output contract violation."],
        followUps: ["Retry researcher phase with tighter prompt constraints."],
      };

      researchBundle = { ...researchBundle as object, [n.id]: safeResearcherPayload };
      logs.push({
        nodeId: n.id,
        nodeType: "researcher",
        status: "ok",
        output: {
          ...finalSub,
          parsed: safeResearcherPayload,
          validFormat: !!researcherPayload,
          reparsed,
        },
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
        runId: params.runId,
      });
      let finalSub = sub;
      let strategistPayload = parseStrategistHermesPayload(sub.text);
      let reparsed = false;

      if (!strategistPayload) {
        reparsed = true;
        const retrySub = await runHermesRole({
          role: "strategist",
          userPrompt:
            "Return STRICT JSON only with shape {\"thesis\": string, \"actions\": string[], \"riskControls\": string[]}. No markdown.",
          contextJson: {
            monitor: monitorBundle,
            research: researchBundle,
            previous_response: sub.text,
          },
          runId: params.runId,
        });
        finalSub = retrySub;
        strategistPayload = parseStrategistHermesPayload(retrySub.text);
      }

      const safeStrategistPayload: StrategistHermesPayload = strategistPayload ?? {
        thesis: "Strategy response format invalid; fallback to no-action stance.",
        actions: ["Hold position until valid structured strategy is available."],
        riskControls: ["Do not execute live trade from unstructured strategist output."],
      };

      strategyBundle = { ...strategyBundle as object, [n.id]: safeStrategistPayload };
      logs.push({
        nodeId: n.id,
        nodeType: "strategist",
        status: "ok",
        output: {
          ...finalSub,
          parsed: safeStrategistPayload,
          validFormat: !!strategistPayload,
          reparsed,
        },
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
        runId: params.runId,
      });
      supervisorHermesText = sub.text;
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

      /** UI `dryRun` overrides default policy when provided. */
      const isDryRun =
        params.dryRun !== undefined ? params.dryRun : policy.dryRun;
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

      const traderHermes = await runHermesRole({
        role: "trader",
        userPrompt: params.objective ?? "Validate strategy and prepare execution plan.",
        contextJson: {
          objective: params.objective ?? null,
          config: cfg,
          monitor: monitorBundle,
          research: researchBundle,
          strategy: strategyBundle,
          supervisor: supervisorHermesText ?? null,
        },
        runId: params.runId,
      });

      let finalTraderHermes = traderHermes;
      let traderPayload = parseTraderHermesPayload(traderHermes.text);
      let reparsed = false;

      if (!traderPayload) {
        reparsed = true;
        const retrySub = await runHermesRole({
          role: "trader",
          userPrompt:
            "Return STRICT JSON only with shape {\"decision\": \"execute\"|\"hold\", \"reason\": string, \"checks\": string[]}. No markdown.",
          contextJson: {
            objective: params.objective ?? null,
            config: cfg,
            monitor: monitorBundle,
            research: researchBundle,
            strategy: strategyBundle,
            supervisor: supervisorHermesText ?? null,
            previous_response: traderHermes.text,
          },
          runId: params.runId,
        });
        finalTraderHermes = retrySub;
        traderPayload = parseTraderHermesPayload(retrySub.text);
      }

      const safeTraderPayload: TraderHermesPayload = traderPayload ?? {
        decision: "hold",
        reason: "Trader response format invalid; defaulting to hold for safety.",
        checks: ["Do not submit live orders from unstructured trader output."],
      };

      if (isDryRun) {
        logs.push({
          nodeId: n.id,
          nodeType: "trader",
          status: "ok",
          output: {
            dryRun: true,
            wouldSubmit: cfg,
            hermes: {
              ...finalTraderHermes,
              parsed: safeTraderPayload,
              validFormat: !!traderPayload,
              reparsed,
            },
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
          output: {
            hermes: {
              ...finalTraderHermes,
              parsed: safeTraderPayload,
              validFormat: !!traderPayload,
              reparsed,
            },
          },
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
        output: {
          hermes: {
            ...finalTraderHermes,
            parsed: safeTraderPayload,
            validFormat: !!traderPayload,
            reparsed,
          },
          swap: swapRes,
          botswap,
        },
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
    const config = getConfig<Record<string, unknown>>(n);
    const audit = {
      serverId:
        (typeof config.mcpServerId === "string" && config.mcpServerId) ||
        (typeof config.serverId === "string" && config.serverId) ||
        null,
      url:
        (typeof config.mcpUrl === "string" && config.mcpUrl) ||
        (typeof config.url === "string" && config.url) ||
        null,
      transport:
        (typeof config.transport === "string" && config.transport) || null,
    };
    logs.push({
      nodeId: n.id,
      nodeType: "tool",
      status: "ok",
      output: {
        note: "Connect MCP server in production; config only in MVP.",
        audit,
        config,
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
