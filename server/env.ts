/**
 * Server-only environment accessors. Never import this module from client components.
 */
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
} {
  return {
    apiUrl: process.env.HERMES_API_URL?.trim(),
    apiKey: process.env.HERMES_API_KEY?.trim(),
  };
}
