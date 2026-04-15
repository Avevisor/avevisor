"use client";

import type { Node } from "@xyflow/react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SUPERVISOR_NODE_ID } from "@/lib/flow-template";

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
  const cfg = { ...(d.config ?? {}) } as Record<string, string | boolean | number>;
  const nodeId = selectedNode.id;

  function setField(key: string, value: string | boolean | number) {
    onChange(nodeId, {
      ...d,
      config: { ...cfg, [key]: value },
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
              onChange={(e) => setField("objective", e.target.value)}
            />
          </label>
        )}

        {d.nodeType === "researcher" && (
          <label className="grid gap-1">
            <span className="text-muted-foreground">Topics</span>
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5"
              value={String(cfg.topics ?? "")}
              onChange={(e) => setField("topics", e.target.value)}
            />
          </label>
        )}

        {d.nodeType === "monitor" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Chain</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.chain ?? "solana")}
                onChange={(e) => setField("chain", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Wallet address</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.walletAddress ?? "")}
                onChange={(e) => setField("walletAddress", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Token id (addr-chain)</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                placeholder="Mint-solana"
                value={String(cfg.tokenId ?? "")}
                onChange={(e) => setField("tokenId", e.target.value)}
              />
            </label>
          </>
        )}

        {d.nodeType === "strategist" && (
          <label className="grid gap-1">
            <span className="text-muted-foreground">Risk notes</span>
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5"
              value={String(cfg.riskNotes ?? "")}
              onChange={(e) => setField("riskNotes", e.target.value)}
            />
          </label>
        )}

        {d.nodeType === "trader" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">Chain</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.chain ?? "")}
                onChange={(e) => setField("chain", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">assetsId</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.assetsId ?? "")}
                onChange={(e) => setField("assetsId", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">inTokenAddress</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.inTokenAddress ?? "")}
                onChange={(e) => setField("inTokenAddress", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">outTokenAddress</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.outTokenAddress ?? "")}
                onChange={(e) => setField("outTokenAddress", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">inAmount (min units)</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.inAmount ?? "")}
                onChange={(e) => setField("inAmount", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">swapType</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.swapType ?? "buy")}
                onChange={(e) => setField("swapType", e.target.value)}
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
                onChange={(e) => setField("slippageBps", e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.useMev)}
                onChange={(e) => setField("useMev", e.target.checked)}
              />
              <span className="text-muted-foreground">useMev</span>
            </label>
          </>
        )}

        {d.nodeType === "wallet" && (
          <label className="grid gap-1">
            <span className="text-muted-foreground">assetsName (new wallet)</span>
            <input
              className="rounded-md border border-input bg-background px-2 py-1.5"
              value={String(cfg.assetsName ?? "")}
              onChange={(e) => setField("assetsName", e.target.value)}
            />
          </label>
        )}

        {d.nodeType === "tool" && (
          <>
            <label className="grid gap-1">
              <span className="text-muted-foreground">toolId</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.toolId ?? "")}
                onChange={(e) => setField("toolId", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted-foreground">MCP endpoint (optional)</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1.5"
                value={String(cfg.mcpEndpoint ?? "")}
                onChange={(e) => setField("mcpEndpoint", e.target.value)}
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
