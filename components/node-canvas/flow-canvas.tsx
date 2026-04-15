"use client";

import "@xyflow/react/dist/style.css";

import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getDefaultNodeConfig } from "@/lib/node-schema/contracts";
import type { AgentNodeType } from "@/lib/node-schema/types";
import { validateFlowGraph } from "@/lib/node-schema/validation";
import {
  FLOW_STORAGE_KEY,
  getDefaultFlowTemplate,
  SUPERVISOR_NODE_ID,
} from "@/lib/flow-template";

import type { AgentNodeData } from "./agent-node";
import { AgentNode } from "./agent-node";
import { NodeSettingsPanel } from "./node-settings-panel";

const nodeTypes = { agent: AgentNode };

const palette: { type: AgentNodeType; label: string; letter: string }[] = [
  { type: "researcher", label: "Researcher", letter: "R" },
  { type: "monitor", label: "Monitor", letter: "M" },
  { type: "strategist", label: "Strategist", letter: "P" },
  { type: "trader", label: "Trader", letter: "T" },
  { type: "wallet", label: "Wallet", letter: "W" },
  { type: "tool", label: "Tool", letter: "X" },
];

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `n-${Date.now()}-${idCounter}`;
}

/**
 * Ensures the canvas always has exactly one fixed Supervisor node.
 * If the saved state is invalid, fallback to default template.
 */
function enforceSingleSupervisor(input: {
  nodes: Node[];
  edges: Edge[];
}): { nodes: Node[]; edges: Edge[] } {
  const supervisors = input.nodes.filter(
    (n) => (n.data as AgentNodeData | undefined)?.nodeType === "supervisor",
  );
  if (supervisors.length !== 1) return getDefaultFlowTemplate();
  const supervisor = supervisors[0];
  if (supervisor.id !== SUPERVISOR_NODE_ID) return getDefaultFlowTemplate();
  return input;
}

/**
 * Inner canvas with access to React Flow projection for palette drops.
 */
function FlowCanvasInner() {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runLog, setRunLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [confirmLive, setConfirmLive] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FLOW_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { nodes: Node[]; edges: Edge[] };
        const safe = enforceSingleSupervisor(parsed);
        setNodes(safe.nodes);
        setEdges(safe.edges);
      } else {
        const seed = getDefaultFlowTemplate();
        setNodes(seed.nodes);
        setEdges(seed.edges);
      }
    } catch {
      const seed = getDefaultFlowTemplate();
      setNodes(seed.nodes);
      setEdges(seed.edges);
    }
    setHydrated(true);
  }, [setNodes, setEdges]);

  useEffect(() => {
    function onReset() {
      const seed = getDefaultFlowTemplate();
      setNodes(seed.nodes);
      setEdges(seed.edges);
      localStorage.setItem(
        FLOW_STORAGE_KEY,
        JSON.stringify({ nodes: seed.nodes, edges: seed.edges }),
      );
      setValidation("Reset to a single Supervisor.");
    }
    window.addEventListener("avevisor:reset-flow", onReset);
    return () => window.removeEventListener("avevisor:reset-flow", onReset);
  }, [setNodes, setEdges]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/reactflow");
      if (!raw) return;
      const nodeType = raw as AgentNodeType;
      if (nodeType === "supervisor") return;
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const label =
        palette.find((p) => p.type === nodeType)?.label ?? nodeType;
      const newNode: Node = {
        id: nextId(),
        type: "agent",
        position,
        data: {
          label,
          nodeType,
          config: getDefaultNodeConfig(nodeType),
        } satisfies AgentNodeData,
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, screenToFlowPosition],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => setSelectedId(node.id),
    [],
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: AgentNodeData) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data } : n)),
      );
    },
    [setNodes],
  );

  /** Removes a node and any edges touching it; clears selection. */
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
      setSelectedId((id) => (id === nodeId ? null : id));
    },
    [setNodes, setEdges],
  );

  const persist = useCallback(
    (n: Node[], e: Edge[]) => {
      localStorage.setItem(
        FLOW_STORAGE_KEY,
        JSON.stringify({ nodes: n, edges: e }),
      );
    },
    [],
  );

  const handleValidate = useCallback(() => {
    const v = validateFlowGraph({
      nodes: nodes.map((n) => ({
        id: n.id,
                data: n.data as { nodeType?: string; config?: unknown },
      })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    });
    if (v.ok) {
      setValidation("Graph OK: single Supervisor present.");
      return;
    }
    setValidation(v.errors.join("\n"));
  }, [nodes, edges]);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setRunLog(null);
    try {
      const sup = nodes.find(
        (n) => (n.data as AgentNodeData).nodeType === "supervisor",
      );
      const supervisorConfig = (sup?.data as AgentNodeData | undefined)?.config;
      const objective =
        supervisorConfig &&
        typeof supervisorConfig === "object" &&
        typeof (supervisorConfig as { objective?: unknown }).objective === "string"
          ? ((supervisorConfig as { objective?: string }).objective ?? undefined)
          : undefined;
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
          objective,
          dryRun,
          confirmLive,
        }),
      });
      const json = await res.json();
      setRunLog(JSON.stringify(json, null, 2));
    } catch (e) {
      setRunLog(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, dryRun, confirmLive]);

  const handleSave = useCallback(() => {
    persist(nodes, edges);
    setValidation("Saved to browser storage.");
  }, [nodes, edges, persist]);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading canvas…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-1">
      <aside className="flex w-52 flex-col gap-2 border-r border-border bg-muted/30 p-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Nodes
        </div>
        {palette.map((p) => (
          <div
            key={p.type}
            className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-border bg-card p-2 active:cursor-grabbing"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/reactflow", p.type);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
              {p.letter}
            </div>
            <span className="text-center text-xs font-medium">{p.label}</span>
          </div>
        ))}
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/80 p-2">
          <Button size="sm" variant="outline" type="button" onClick={handleValidate}>
            Validate
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={handleRun}
            disabled={loading}
          >
            {loading ? "Running…" : "Run"}
          </Button>
          <Button size="sm" variant="secondary" type="button" onClick={handleSave}>
            Save template
          </Button>
          <label className="ml-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (no live trade)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={confirmLive}
              onChange={(e) => setConfirmLive(e.target.checked)}
            />
            Confirm live trade
          </label>
        </div>
        {validation && (
          <pre className="max-h-24 overflow-auto border-b border-border bg-muted/20 px-3 py-2 text-xs whitespace-pre-wrap">
            {validation}
          </pre>
        )}
        <div className="min-h-[400px] flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background"
          >
            <MiniMap />
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
        </div>
        {runLog && (
          <pre className="max-h-48 overflow-auto border-t border-border bg-muted/30 p-3 text-xs">
            {runLog}
          </pre>
        )}
      </div>

      <div className="hidden w-80 shrink-0 md:block">
        <NodeSettingsPanel
          node={selectedNode}
          onChange={updateNodeData}
          onClose={() => setSelectedId(null)}
          onDeleteNode={deleteNode}
        />
      </div>
    </div>
  );
}

/**
 * Main React Flow canvas: palette drag, connect, run, validation output.
 */
export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
