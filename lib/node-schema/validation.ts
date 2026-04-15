import { z } from "zod";

import { agentNodeConfigSchemaByType } from "./contracts";
import type { AgentNodeType } from "./types";

const agentNodeTypeSchema = z.enum([
  "supervisor",
  "researcher",
  "monitor",
  "strategist",
  "trader",
  "wallet",
  "tool",
]);

/** Validates that the graph has exactly one supervisor root and basic edge rules. */
export function validateFlowGraph(input: {
  nodes: Array<{
    id: string;
    type?: string;
    data?: { nodeType?: string; config?: unknown };
  }>;
  edges: Array<{ source: string; target: string }>;
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const supervisors = input.nodes.filter(
    (n) => (n.data?.nodeType as AgentNodeType | undefined) === "supervisor",
  );
  if (supervisors.length !== 1) {
    errors.push("Graph must contain exactly one Supervisor node.");
  }

  const ids = new Set(input.nodes.map((n) => n.id));
  for (const e of input.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      errors.push(`Edge references unknown node: ${e.source} -> ${e.target}`);
    }
  }

  for (const n of input.nodes) {
    const nodeType = parseAgentNodeType(n.data?.nodeType);
    if (!nodeType) {
      errors.push(`Node ${n.id} has unsupported nodeType.`);
      continue;
    }
    const schema = agentNodeConfigSchemaByType[nodeType];
    const parsed = schema.safeParse(n.data?.config ?? {});
    if (!parsed.success) {
      const issueText = parsed.error.issues
        .map((issue) => {
          const path = issue.path.length ? issue.path.join(".") : "config";
          return `${path}: ${issue.message}`;
        })
        .join("; ");
      errors.push(`Node ${n.id} (${nodeType}) config invalid: ${issueText}`);
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

export function parseAgentNodeType(value: unknown): AgentNodeType | null {
  const r = agentNodeTypeSchema.safeParse(value);
  return r.success ? r.data : null;
}
