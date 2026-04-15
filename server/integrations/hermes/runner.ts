import {
  monitorSkill,
  researcherSkill,
  strategistSkill,
  supervisorSkill,
} from "./skills";

export type HermesRole =
  | "supervisor"
  | "researcher"
  | "monitor"
  | "strategist";

const skillByRole: Record<HermesRole, string> = {
  supervisor: supervisorSkill,
  researcher: researcherSkill,
  monitor: monitorSkill,
  strategist: strategistSkill,
};

/**
 * Invokes Hermes-compatible HTTP API if configured; otherwise returns structured mock output for demos.
 */
export async function runHermesRole(params: {
  role: HermesRole;
  userPrompt: string;
  contextJson?: unknown;
}): Promise<{ text: string; mock: boolean }> {
  const system = skillByRole[params.role];
  const apiUrl = process.env.HERMES_API_URL?.trim();
  const apiKey = process.env.HERMES_API_KEY?.trim();

  if (!apiUrl) {
    return {
      mock: true,
      text: JSON.stringify({
        role: params.role,
        echo: params.userPrompt.slice(0, 500),
        context: params.contextJson ?? null,
        note: "Set HERMES_API_URL for live Hermes. Mock response for MVP.",
      }),
    };
  }

  const body = {
    model: process.env.HERMES_MODEL ?? "hermes",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `${params.userPrompt}\n\nContext:\n${JSON.stringify(params.contextJson ?? {})}`,
      },
    ],
  };

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Hermes HTTP ${res.status}: ${t}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, mock: false };
}
