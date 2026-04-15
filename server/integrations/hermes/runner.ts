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
const degradedHermesByRun = new Map<string, string>();
const MAX_DEGRADED_RUN_CACHE = 200;

function markHermesRunDegraded(runId: string | undefined, note: string): void {
  if (!runId) return;
  degradedHermesByRun.set(runId, note);
  if (degradedHermesByRun.size <= MAX_DEGRADED_RUN_CACHE) return;
  const oldestKey = degradedHermesByRun.keys().next().value;
  if (!oldestKey) return;
  degradedHermesByRun.delete(oldestKey);
}

function getHermesRunDegradedNote(runId: string | undefined): string | null {
  if (!runId) return null;
  return degradedHermesByRun.get(runId) ?? null;
}

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

function getHermesUpstreamErrorText(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  if (/^Error code:\s*\d+/i.test(normalized)) return normalized;
  if (normalized.includes("No endpoints found for")) return normalized;
  if (normalized.includes('"code": "invalid_api_key"')) return normalized;
  if (/API call failed after \d+ retries:\s*HTTP 429/i.test(normalized)) return normalized;
  if (/Rate limit exceeded/i.test(normalized)) return normalized;
  if (/free-models-per-(day|min)/i.test(normalized)) return normalized;
  return null;
}

function isNoEndpointModelError(errorText: string): boolean {
  return errorText.includes("No endpoints found for");
}

function parseHermesMaxTokens(): number | undefined {
  const raw = process.env.HERMES_MAX_TOKENS?.trim();
  if (!raw) return 4096;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 4096;
  return Math.floor(parsed);
}

function buildMockResponse(params: {
  role: HermesRole;
  userPrompt: string;
  contextJson?: unknown;
  note: string;
}): { text: string; mock: boolean } {
  const echo = params.userPrompt.slice(0, 500);
  const context = params.contextJson ?? null;
  if (params.role === "monitor") {
    return {
      mock: true,
      text: JSON.stringify({
        role: params.role,
        alerts: [`Hermes unavailable, monitor mock used: ${params.note}`],
        sentiment: "neutral",
        echo,
        context,
        note: params.note,
      }),
    };
  }
  if (params.role === "researcher") {
    return {
      mock: true,
      text: JSON.stringify({
        role: params.role,
        findings: [`Hermes unavailable, researcher mock used: ${params.note}`],
        risks: ["Research confidence reduced because provider response was unavailable."],
        followUps: ["Retry researcher phase when Hermes provider recovers."],
        echo,
        context,
        note: params.note,
      }),
    };
  }
  if (params.role === "strategist") {
    return {
      mock: true,
      text: JSON.stringify({
        role: params.role,
        thesis: "Hermes unavailable; defaulting to defensive no-action strategy.",
        actions: ["Hold position until a valid strategist response is available."],
        riskControls: ["Do not execute live trade based on degraded strategist output."],
        echo,
        context,
        note: params.note,
      }),
    };
  }
  if (params.role === "trader") {
    return {
      mock: true,
      text: JSON.stringify({
        role: params.role,
        decision: "hold",
        reason: `Hermes unavailable, trader mock used: ${params.note}`,
        checks: ["Do not submit live orders while trader model output is degraded."],
        echo,
        context,
        note: params.note,
      }),
    };
  }
  if (params.role === "supervisor") {
    return {
      mock: true,
      text: JSON.stringify({
        role: params.role,
        next: [],
        rationale: `Hermes unavailable, supervisor mock used: ${params.note}`,
        echo,
        context,
        note: params.note,
      }),
    };
  }
  return {
    mock: true,
    text: JSON.stringify({
      role: params.role,
      echo,
      context,
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
  const primaryModel = process.env.HERMES_MODEL?.trim() || "hermes";
  const fallbackModel = process.env.HERMES_MODEL_FALLBACK?.trim() || "hermes";
  const maxTokens = parseHermesMaxTokens();
  const shouldFallback = shouldFallbackToMockOnFetchError();

  if (!apiUrl) {
    return buildMockResponse({
      role: params.role,
      userPrompt: params.userPrompt,
      contextJson: params.contextJson,
      note: "Set HERMES_API_URL for live Hermes. Mock response for MVP.",
    });
  }

  const degradedRunNote = shouldFallback ? getHermesRunDegradedNote(params.runId) : null;
  if (degradedRunNote) {
    return buildMockResponse({
      role: params.role,
      userPrompt: params.userPrompt,
      contextJson: params.contextJson,
      note: `Hermes run degraded mode active, skipped upstream call: ${degradedRunNote}`,
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
      model: primaryModel,
      input: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      conversation: `avevisor-${params.runId}`,
      ...(maxTokens ? { max_output_tokens: maxTokens } : {}),
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
      if (shouldFallback) {
        const note = `Hermes responses unavailable, used mock fallback: ${getErrorMessage(error)}`;
        markHermesRunDegraded(params.runId, note);
        return buildMockResponse({
          role: params.role,
          userPrompt: params.userPrompt,
          contextJson: params.contextJson,
          note,
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

    let data = (await responseRes.json()) as HermesResponsesApiResponse;
    if (data.id) {
      supervisorResponseIdByRun.set(params.runId, data.id);
    }
    let text = extractResponsesApiText(data);
    const upstreamError = getHermesUpstreamErrorText(text);
    if (
      upstreamError &&
      isNoEndpointModelError(upstreamError) &&
      fallbackModel !== primaryModel
    ) {
      const retryBody = {
        ...responseBody,
        model: fallbackModel,
      };
      const retryRes = await fetch(responsesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(retryBody),
      });
      if (retryRes.ok) {
        data = (await retryRes.json()) as HermesResponsesApiResponse;
        if (data.id) {
          supervisorResponseIdByRun.set(params.runId, data.id);
        }
        text = extractResponsesApiText(data);
      }
    }
    const retryUpstreamError = getHermesUpstreamErrorText(text);
    if (retryUpstreamError) {
      if (shouldFallback) {
        const note = `Hermes upstream model/provider error, used mock fallback: ${retryUpstreamError}`;
        markHermesRunDegraded(params.runId, note);
        return buildMockResponse({
          role: params.role,
          userPrompt: params.userPrompt,
          contextJson: params.contextJson,
          note,
        });
      }
      throw new Error(`Hermes upstream model/provider error: ${retryUpstreamError}`);
    }
    return { text, mock: false };
  }

  const body = {
    model: primaryModel,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: userMessage,
      },
    ],
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
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
    if (shouldFallback) {
      const note = `Hermes chat unavailable, used mock fallback: ${getErrorMessage(error)}`;
      markHermesRunDegraded(params.runId, note);
      return buildMockResponse({
        role: params.role,
        userPrompt: params.userPrompt,
        contextJson: params.contextJson,
        note,
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

  let data = (await res.json()) as HermesCompletionResponse;
  let text = data.choices?.[0]?.message?.content ?? "";
  const upstreamError = getHermesUpstreamErrorText(text);
  if (
    upstreamError &&
    isNoEndpointModelError(upstreamError) &&
    fallbackModel !== primaryModel
  ) {
    const retryBody = { ...body, model: fallbackModel };
    const retryRes = await fetch(chatCompletionsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(retryBody),
    });
    if (retryRes.ok) {
      data = (await retryRes.json()) as HermesCompletionResponse;
      text = data.choices?.[0]?.message?.content ?? "";
    }
  }

  const retryUpstreamError = getHermesUpstreamErrorText(text);
  if (retryUpstreamError) {
    if (shouldFallback) {
      const note = `Hermes upstream model/provider error, used mock fallback: ${retryUpstreamError}`;
      markHermesRunDegraded(params.runId, note);
      return buildMockResponse({
        role: params.role,
        userPrompt: params.userPrompt,
        contextJson: params.contextJson,
        note,
      });
    }
    throw new Error(`Hermes upstream model/provider error: ${retryUpstreamError}`);
  }
  return { text, mock: false };
}
