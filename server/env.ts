/**
 * Server-only environment accessors. Never import this module from client components.
 */

function normalizeHermesApiUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export function getDelegateCredentials():
  | { accessKey: string; secretKey: string }
  | null {
  const accessKey = process.env.AVE_ACCESS_KEY?.trim();
  const secretKey = process.env.AVE_SECRET_KEY?.trim();
  if (!accessKey || !secretKey) return null;
  return { accessKey, secretKey };
}

export function getDataApiKey(): string | null {
  const k = process.env.AVE_DATA_API_KEY?.trim();
  return k || null;
}

export function getHermesConfig(): {
  apiUrl?: string;
  apiKey?: string;
  useResponses: boolean;
} {
  const rawUrl = process.env.HERMES_API_URL?.trim();
  return {
    apiUrl: rawUrl ? normalizeHermesApiUrl(rawUrl) : undefined,
    apiKey: process.env.HERMES_API_KEY?.trim(),
    useResponses: process.env.HERMES_USE_RESPONSES === "true",
  };
}
