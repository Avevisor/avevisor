import { NextResponse } from "next/server";

import { getDataApiKey, getDelegateCredentials, getHermesConfig } from "@/server/env";

async function probeHermes(baseApiUrl?: string): Promise<{
  configured: boolean;
  reachable: boolean;
  checkedUrl?: string;
  error?: string;
}> {
  if (!baseApiUrl) {
    return { configured: false, reachable: false };
  }

  const healthUrls = [
    `${baseApiUrl}/health`,
    `${baseApiUrl.replace(/\/v1$/, "")}/health`,
  ];

  for (const healthUrl of healthUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
      });
      if (res.ok) {
        clearTimeout(timeout);
        return {
          configured: true,
          reachable: true,
          checkedUrl: healthUrl,
        };
      }
    } catch (error) {
      clearTimeout(timeout);
      const message = error instanceof Error ? error.message : String(error);
      return {
        configured: true,
        reachable: false,
        checkedUrl: healthUrl,
        error: message,
      };
    }
    clearTimeout(timeout);
  }

  return {
    configured: true,
    reachable: false,
    checkedUrl: healthUrls[0],
    error: "No successful Hermes health response",
  };
}

/**
 * GET /api/health — configuration probe (no secrets exposed).
 */
export async function GET() {
  const hermes = getHermesConfig();
  const hermesProbe = await probeHermes(hermes.apiUrl);

  return NextResponse.json({
    ok: true,
    hasDelegateKeys: Boolean(getDelegateCredentials()),
    hasDataApiKey: Boolean(getDataApiKey()),
    hasHermesUrl: Boolean(hermes.apiUrl),
    hermes: {
      apiUrl: hermes.apiUrl ?? null,
      useResponses: hermes.useResponses,
      ...hermesProbe,
    },
  });
}
