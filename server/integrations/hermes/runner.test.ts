import { afterEach, describe, expect, it } from "vitest";

import { runHermesRole } from "./runner";
import { traderSkill } from "./skills";

const originalApiUrl = process.env.HERMES_API_URL;
const originalFallback = process.env.HERMES_FALLBACK_TO_MOCK_ON_ERROR;
const originalModel = process.env.HERMES_MODEL;
const originalFallbackModel = process.env.HERMES_MODEL_FALLBACK;
const originalFetch = global.fetch;

afterEach(() => {
  if (originalApiUrl === undefined) {
    delete process.env.HERMES_API_URL;
  } else {
    process.env.HERMES_API_URL = originalApiUrl;
  }
  if (originalFallback === undefined) {
    delete process.env.HERMES_FALLBACK_TO_MOCK_ON_ERROR;
  } else {
    process.env.HERMES_FALLBACK_TO_MOCK_ON_ERROR = originalFallback;
  }
  if (originalModel === undefined) {
    delete process.env.HERMES_MODEL;
  } else {
    process.env.HERMES_MODEL = originalModel;
  }
  if (originalFallbackModel === undefined) {
    delete process.env.HERMES_MODEL_FALLBACK;
  } else {
    process.env.HERMES_MODEL_FALLBACK = originalFallbackModel;
  }
  global.fetch = originalFetch;
});

describe("hermes runner", () => {
  it("returns mock trader payload when HERMES_API_URL is unset", async () => {
    delete process.env.HERMES_API_URL;
    const result = await runHermesRole({
      role: "trader",
      userPrompt: "Validate this trade setup",
      contextJson: { chain: "solana" },
      runId: "test-run-1",
    });

    expect(result.mock).toBe(true);
    const parsed = JSON.parse(result.text) as { role?: string };
    expect(parsed.role).toBe("trader");
  });

  it("loads trader skill content with required sections", () => {
    expect(traderSkill).toContain("## Base role");
    expect(traderSkill).toContain("## Memory");
    expect(traderSkill).toContain("## Planning");
    expect(traderSkill).toContain("## Safety");
  });

  it("falls back to mock when Hermes fetch fails", async () => {
    process.env.HERMES_API_URL = "http://127.0.0.1:8642/v1";
    process.env.HERMES_FALLBACK_TO_MOCK_ON_ERROR = "true";
    global.fetch = (async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8642");
    }) as typeof fetch;

    const result = await runHermesRole({
      role: "supervisor",
      userPrompt: "Summarize latest monitor findings",
      contextJson: { chain: "solana" },
      runId: "test-run-2",
    });

    expect(result.mock).toBe(true);
    expect(result.text).toContain("Hermes chat unavailable, used mock fallback");
  });

  it("falls back to mock when Hermes returns provider endpoint error text", async () => {
    process.env.HERMES_API_URL = "http://127.0.0.1:8642/v1";
    process.env.HERMES_FALLBACK_TO_MOCK_ON_ERROR = "true";
    global.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "Error code: 404 - {'error': {'message': 'No endpoints found for qwen/qwen3.6-plus-preview:free.', 'code': 404}}",
              },
            },
          ],
        }),
      }) as Response) as typeof fetch;

    const result = await runHermesRole({
      role: "monitor",
      userPrompt: "Summarize market state",
      contextJson: { chain: "solana" },
      runId: "test-run-3",
    });

    expect(result.mock).toBe(true);
    expect(result.text).toContain("Hermes upstream model/provider error, used mock fallback");
    expect(result.text).toContain("No endpoints found for qwen/qwen3.6-plus-preview:free");
  });

  it("retries with fallback model before using mock", async () => {
    process.env.HERMES_API_URL = "http://127.0.0.1:8642/v1";
    process.env.HERMES_MODEL = "qwen/qwen3.6-plus-preview:free";
    process.env.HERMES_MODEL_FALLBACK = "hermes";
    process.env.HERMES_FALLBACK_TO_MOCK_ON_ERROR = "true";

    let callCount = 0;
    global.fetch = (async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content:
                    "Error code: 404 - {'error': {'message': 'No endpoints found for qwen/qwen3.6-plus-preview:free.', 'code': 404}}",
                },
              },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Fallback model response is healthy.",
              },
            },
          ],
        }),
      } as Response;
    }) as typeof fetch;

    const result = await runHermesRole({
      role: "monitor",
      userPrompt: "Summarize market state",
      contextJson: { chain: "solana" },
      runId: "test-run-4",
    });

    expect(callCount).toBe(2);
    expect(result.mock).toBe(false);
    expect(result.text).toBe("Fallback model response is healthy.");
  });
});
