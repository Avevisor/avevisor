"use client";

import type { Node } from "@xyflow/react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SUPERVISOR_NODE_ID } from "@/lib/flow-template";
import { coerceNodeConfig } from "@/lib/node-schema/contracts";
import type { AgentNodeConfigByType, AgentNodeType } from "@/lib/node-schema/types";

import type { AgentNodeData } from "./agent-node";

/**
 * Right-hand settings form for the selected node (per nodeType).
 */
export function NodeSettingsPanel({
  node,
  onChange,
  onClose,
  onDeleteNode,
}: {
  node: Node | null;
  onChange: (nodeId: string, data: AgentNodeData) => void;
  onClose: () => void;
  /** Removes the node and its edges after user confirms (not used for Supervisor). */
  onDeleteNode: (nodeId: string) => void;
}) {
  if (!node || !node.data) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Settings</h2>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onClose}>
            ×
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Select a node on the canvas to edit its configuration.
        </p>
      </div>
    );
  }

  const selectedNode = node;
  const d = selectedNode.data as AgentNodeData;
  const cfg = coerceNodeConfig(d.nodeType, d.config ?? {}) as unknown as Record<
    string,
    string | boolean | number | undefined
  >;
  const nodeId = selectedNode.id;

  function setField<TNodeType extends AgentNodeType>(
    nodeType: TNodeType,
    key: keyof AgentNodeConfigByType[TNodeType],
    value: AgentNodeConfigByType[TNodeType][keyof AgentNodeConfigByType[TNodeType]],
  ) {
    const current = coerceNodeConfig(nodeType, d.config ?? {});
    onChange(nodeId, {
      ...d,
      config: { ...current, [key]: value },
    });
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 className="text-sm font-semibold">Settings</h2>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onClose}>
          ×
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        <label className="grid gap-1">
          <span className="text-muted-foreground">Label</span>
          <input
            className="rounded-md border border-input bg-background px-2 py-1.5"
            value={d.label}
            onChange={(e) =>
              onChange(nodeId, { ...d, label: e.target.value })
            }
          />
        </label>

        {d.nodeType === "supervisor" && (
          <label className="grid gap-1">
            <span className="text-muted-foreground">Objective</span>
            <textarea
              className="min-h-[80px] rounded-md border border-input bg-background px-2 py-1.5"
              value={String(cfg.objective ?? "")}
              onChange={(e) => setField("supervisor", "objective", e.target.value)}
            />
          </label>
        )}

        {d.nodeType === "researcher" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Topics</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.topics ?? "")}
                onChange={(e) => setField("researcher", "topics", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Research instruction</span>
              <textarea
                className="min-h-[80px] rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.instruction ?? "")}
                onChange={(e) =>
                  setField("researcher", "instruction", e.target.value)
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Output format</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.outputFormat ?? "json")}
                onChange={(e) =>
                  setField("researcher", "outputFormat", e.target.value as "json" | "text")
                }
              >
                <option value="json">json</option>
                <option value="text">text</option>
              </select>
            </label>
          </>
        )}

        {d.nodeType === "monitor" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Chain</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.chain ?? "solana")}
                onChange={(e) => setField("monitor", "chain", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Wallet address</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.walletAddress ?? "")}
                onChange={(e) =>
                  setField("monitor", "walletAddress", e.target.value)
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Token id (addr-chain)</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                placeholder="Mint-solana"
                value={String(cfg.tokenId ?? "")}
                onChange={(e) => setField("monitor", "tokenId", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Alert condition</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.alertCondition ?? "change-threshold")}
                onChange={(e) =>
                  setField(
                    "monitor",
                    "alertCondition",
                    e.target.value as
                      | "price-threshold"
                      | "change-threshold"
                      | "transaction-spike"
                      | "custom",
                  )
                }
              >
                <option value="price-threshold">price-threshold</option>
                <option value="change-threshold">change-threshold</option>
                <option value="transaction-spike">transaction-spike</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Alert instruction</span>
              <textarea
                className="min-h-[70px] rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.alertInstruction ?? "")}
                onChange={(e) =>
                  setField("monitor", "alertInstruction", e.target.value)
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.monitorTransactions)}
                onChange={(e) =>
                  setField("monitor", "monitorTransactions", e.target.checked)
                }
              />
              <span className="text-muted-foreground">Monitor transactions</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.monitorKlines)}
                onChange={(e) => setField("monitor", "monitorKlines", e.target.checked)}
              />
              <span className="text-muted-foreground">Monitor klines</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.monitorPriceChange)}
                onChange={(e) =>
                  setField("monitor", "monitorPriceChange", e.target.checked)
                }
              />
              <span className="text-muted-foreground">Monitor price change</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.monitorWallet)}
                onChange={(e) => setField("monitor", "monitorWallet", e.target.checked)}
              />
              <span className="text-muted-foreground">Monitor wallet</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.monitorToken)}
                onChange={(e) => setField("monitor", "monitorToken", e.target.checked)}
              />
              <span className="text-muted-foreground">Monitor token</span>
            </label>
          </>
        )}

        {d.nodeType === "strategist" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Risk notes</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.riskNotes ?? "")}
                onChange={(e) => setField("strategist", "riskNotes", e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.improveWithSupervisorFeedback)}
                onChange={(e) =>
                  setField(
                    "strategist",
                    "improveWithSupervisorFeedback",
                    e.target.checked,
                  )
                }
              />
              <span className="text-muted-foreground">Improve with supervisor feedback</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.requiresSupervisorApproval)}
                onChange={(e) =>
                  setField("strategist", "requiresSupervisorApproval", e.target.checked)
                }
              />
              <span className="text-muted-foreground">Requires supervisor approval</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.passToTraderOnApproval)}
                onChange={(e) =>
                  setField("strategist", "passToTraderOnApproval", e.target.checked)
                }
              />
              <span className="text-muted-foreground">Pass to trader after approval</span>
            </label>
          </>
        )}

        {d.nodeType === "trader" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Chain</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.chain ?? "")}
                onChange={(e) => setField("trader", "chain", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">assetsId</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.assetsId ?? "")}
                onChange={(e) => setField("trader", "assetsId", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">inTokenAddress</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.inTokenAddress ?? "")}
                onChange={(e) =>
                  setField("trader", "inTokenAddress", e.target.value)
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">outTokenAddress</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.outTokenAddress ?? "")}
                onChange={(e) =>
                  setField("trader", "outTokenAddress", e.target.value)
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">inAmount (min units)</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.inAmount ?? "")}
                onChange={(e) => setField("trader", "inAmount", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">swapType</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.swapType ?? "buy")}
                onChange={(e) =>
                  setField("trader", "swapType", e.target.value as "buy" | "sell")
                }
              >
                <option value="buy">buy</option>
                <option value="sell">sell</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Slippage (bps)</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.slippageBps ?? "500")}
                onChange={(e) =>
                  setField("trader", "slippageBps", e.target.value)
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.useMev)}
                onChange={(e) => setField("trader", "useMev", e.target.checked)}
              />
              <span className="text-muted-foreground">useMev</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.strictStrategyExecution)}
                onChange={(e) =>
                  setField("trader", "strictStrategyExecution", e.target.checked)
                }
              />
              <span className="text-muted-foreground">Strictly follow strategy</span>
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Strategy source</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.strategySource ?? "strategist-approved")}
                onChange={(e) =>
                  setField(
                    "trader",
                    "strategySource",
                    e.target.value as "strategist-approved" | "manual",
                  )
                }
              >
                <option value="strategist-approved">strategist-approved</option>
                <option value="manual">manual</option>
              </select>
            </label>
          </>
        )}

        {d.nodeType === "wallet" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">assetsName (new wallet)</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.assetsName ?? "")}
                onChange={(e) => setField("wallet", "assetsName", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Wallet provider</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.walletProvider ?? "")}
                onChange={(e) =>
                  setField("wallet", "walletProvider", e.target.value)
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.proxyWalletEnabled)}
                onChange={(e) =>
                  setField("wallet", "proxyWalletEnabled", e.target.checked)
                }
              />
              <span className="text-muted-foreground">Use AVE proxy bot wallet</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.autonomousTradingEnabled)}
                onChange={(e) =>
                  setField("wallet", "autonomousTradingEnabled", e.target.checked)
                }
              />
              <span className="text-muted-foreground">Allow autonomous trading</span>
            </label>
          </>
        )}

        {d.nodeType === "tool" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Platform</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.platform ?? "")}
                onChange={(e) => setField("tool", "platform", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">API/Platform URL</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.apiBaseUrl ?? "")}
                onChange={(e) => setField("tool", "apiBaseUrl", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">toolId</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.toolId ?? "")}
                onChange={(e) => setField("tool", "toolId", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">MCP endpoint (optional)</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.mcpEndpoint ?? "")}
                onChange={(e) => setField("tool", "mcpEndpoint", e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      <div className="flex justify-end border-t border-border p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={nodeId === SUPERVISOR_NODE_ID}
          title={
            nodeId === SUPERVISOR_NODE_ID
              ? "The Supervisor node cannot be deleted"
              : "Delete this node"
          }
          aria-label="Delete node"
          onClick={() => {
            if (nodeId === SUPERVISOR_NODE_ID) return;
            const ok = window.confirm(
              `Delete “${d.label}” (${d.nodeType})? Connected edges will be removed.`,
            );
            if (ok) onDeleteNode(nodeId);
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
