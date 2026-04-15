import {
  monitorSkill,
  researcherSkill,
  strategistSkill,
  supervisorSkill,
  traderSkill,
} from "./skills";

export type HermesRole =
  | "supervisor"
  | "researcher"
  | "monitor"
  | "strategist"
  | "trader";

const skillByRole: Record<HermesRole, string> = {
  supervisor: supervisorSkill,
  researcher: researcherSkill,
  monitor: monitorSkill,
  strategist: strategistSkill,
  trader: traderSkill,
};

const supervisorResponseIdByRun = new Map<string, string>();

interface HermesCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface HermesResponsesApiResponse {
  id?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

function normalizeHermesApiBase(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function buildHermesUserMessage(userPrompt: string, contextJson: unknown): string {
  return `${userPrompt}\n\nContext:\n${JSON.stringify(contextJson ?? {})}`;
}

function extractResponsesApiText(data: HermesResponsesApiResponse): string {
  if (typeof data.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }
  const outputText = data.output
    ?.flatMap((entry) => entry.content ?? [])
    .filter((content) => content?.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
  return outputText ?? "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shouldFallbackToMockOnFetchError(): boolean {
  return process.env.HERMES_FALLBACK_TO_MOCK_ON_ERROR !== "false";
}

function buildMockResponse(params: {
  role: HermesRole;
  userPrompt: string;
  contextJson?: unknown;
  note: string;
}): { text: string; mock: boolean } {
  return {
    mock: true,
    text: JSON.stringify({
      role: params.role,
      echo: params.userPrompt.slice(0, 500),
      context: params.contextJson ?? null,
      note: params.note,
    }),
  };
}

/**
 * Invokes Hermes-compatible HTTP API if configured; otherwise returns structured mock output for demos.
 */
export async function runHermesRole(params: {
  role: HermesRole;
  userPrompt: string;
  contextJson?: unknown;
  runId?: string;
}): Promise<{ text: string; mock: boolean }> {
  const system = skillByRole[params.role];
  const apiUrl = process.env.HERMES_API_URL?.trim();
  const apiKey = process.env.HERMES_API_KEY?.trim();
  const useResponses = process.env.HERMES_USE_RESPONSES === "true";

  if (!apiUrl) {
    return buildMockResponse({
      role: params.role,
      userPrompt: params.userPrompt,
      contextJson: params.contextJson,
      note: "Set HERMES_API_URL for live Hermes. Mock response for MVP.",
    });
  }

  const baseUrl = normalizeHermesApiBase(apiUrl);
  const userMessage = buildHermesUserMessage(params.userPrompt, params.contextJson);

  if (!baseUrl) {
    throw new Error("HERMES_API_URL is set but empty after normalization");
  }

  if (useResponses && params.role === "supervisor" && params.runId) {
    const previousResponseId = supervisorResponseIdByRun.get(params.runId);
    const responseBody: Record<string, unknown> = {
      model: process.env.HERMES_MODEL ?? "hermes",
      input: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      conversation: `avevisor-${params.runId}`,
    };
    if (previousResponseId) {
      responseBody.previous_response_id = previousResponseId;
    }

    const responsesUrl = `${baseUrl}/responses`;
    let responseRes: Response;
    try {
      responseRes = await fetch(responsesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(responseBody),
      });
    } catch (error) {
      if (shouldFallbackToMockOnFetchError()) {
        return buildMockResponse({
          role: params.role,
          userPrompt: params.userPrompt,
          contextJson: params.contextJson,
          note: `Hermes responses unavailable, used mock fallback: ${getErrorMessage(error)}`,
        });
      }
      throw new Error(
        `Hermes responses fetch failed at ${responsesUrl}: ${getErrorMessage(error)}`,
      );
    }

    if (!responseRes.ok) {
      const t = await responseRes.text();
      throw new Error(`Hermes responses HTTP ${responseRes.status}: ${t}`);
    }

    const data = (await responseRes.json()) as HermesResponsesApiResponse;
    if (data.id) {
      supervisorResponseIdByRun.set(params.runId, data.id);
    }
    return { text: extractResponsesApiText(data), mock: false };
  }

  const body = {
    model: process.env.HERMES_MODEL ?? "hermes",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: userMessage,
      },
    ],
  };

  const chatCompletionsUrl = `${baseUrl}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(chatCompletionsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (shouldFallbackToMockOnFetchError()) {
      return buildMockResponse({
        role: params.role,
        userPrompt: params.userPrompt,
        contextJson: params.contextJson,
        note: `Hermes chat unavailable, used mock fallback: ${getErrorMessage(error)}`,
      });
    }
    throw new Error(
      `Hermes chat fetch failed at ${chatCompletionsUrl}: ${getErrorMessage(error)}`,
    );
  }

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Hermes HTTP ${res.status}: ${t}`);
  }

  const data = (await res.json()) as HermesCompletionResponse;
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, mock: false };
}
