import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeFlowNodesConfig, validateFlowGraph } from "@/lib/node-schema/validation";
import { executeFlow } from "@/server/orchestrator/run-engine";

export const runtime = "nodejs";

const runBodySchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  objective: z.string().optional(),
  dryRun: z.boolean().optional(),
  confirmLive: z.boolean().optional(),
});

/**
 * POST /api/runs — executes the node graph on the server (Hermes + AVE).
 */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = runBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { edges, objective, dryRun, confirmLive } = parsed.data;
    const normalizedNodes = normalizeFlowNodesConfig(
      parsed.data.nodes as Array<{
        id: string;
        data?: { nodeType?: string; config?: unknown };
      }>,
    );
    const v = validateFlowGraph({
      nodes: normalizedNodes as {
        id: string;
        data?: { nodeType?: string; config?: unknown };
      }[],
      edges: edges as { source: string; target: string }[],
    });
    if (!v.ok) {
      return NextResponse.json({ error: "Graph invalid", details: v.errors }, { status: 400 });
    }

    const runId = randomUUID();
    const result = await executeFlow({
      runId,
      nodes: normalizedNodes as never[],
      edges: edges as never[],
      objective,
      dryRun,
      confirmLive,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
