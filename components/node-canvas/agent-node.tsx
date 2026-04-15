"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";

import type { AgentNodeType } from "@/lib/node-schema/types";

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  nodeType: AgentNodeType;
  config?: unknown;
}

const typeColors: Record<AgentNodeType, string> = {
  supervisor: "border-violet-500/60 bg-violet-500/10",
  researcher: "border-sky-500/60 bg-sky-500/10",
  monitor: "border-emerald-500/60 bg-emerald-500/10",
  strategist: "border-amber-500/60 bg-amber-500/10",
  trader: "border-rose-500/60 bg-rose-500/10",
  wallet: "border-fuchsia-500/60 bg-fuchsia-500/10",
  tool: "border-muted-foreground/40 bg-muted/40",
};

/**
 * Custom React Flow node rendering role badge and label.
 */
export function AgentNode({ data, selected }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  return (
    <div
      className={cn(
        "min-w-[140px] rounded-lg border-2 px-3 py-2 text-left shadow-sm transition-shadow",
        typeColors[d.nodeType],
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {d.nodeType}
      </div>
      <div className="text-sm font-medium text-foreground">{d.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}
