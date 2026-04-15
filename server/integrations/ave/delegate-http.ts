import { DELEGATE_API_BASE } from "./constants";
import { canonicalJsonString, signAveDelegateRequest } from "./signature";

export interface DelegateCredentials {
  accessKey: string;
  secretKey: string;
}

/**
 * Performs a signed request to the AVE delegate (Bot) REST API.
 */
export async function delegateFetch<T = unknown>(params: {
  credentials: DelegateCredentials;
  method: "GET" | "POST";
  /** Path only, e.g. /v1/thirdParty/user/generateWallet */
  path: string;
  body?: Record<string, unknown> | null;
  searchParams?: Record<string, string | undefined>;
}): Promise<{ ok: boolean; status: number; data: T; rawText: string }> {
  const url = new URL(params.path, DELEGATE_API_BASE);
  if (params.searchParams) {
    for (const [k, v] of Object.entries(params.searchParams)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const bodyObj =
    params.method === "POST" && params.body ? params.body : null;
  const bodyString =
    bodyObj !== null ? canonicalJsonString(bodyObj as Record<string, unknown>) : null;
  const { signature, timestamp } = signAveDelegateRequest({
    apiSecret: params.credentials.secretKey,
    method: params.method,
    requestPath: url.pathname,
    body: bodyObj,
  });

  const headers: Record<string, string> = {
    "AVE-ACCESS-KEY": params.credentials.accessKey,
    "AVE-ACCESS-TIMESTAMP": timestamp,
    "AVE-ACCESS-SIGN": signature,
    "Content-Type": "application/json",
  };

  const res = await fetch(url.toString(), {
    method: params.method,
    headers,
    body: params.method === "POST" && bodyString !== null ? bodyString : undefined,
  });

  const rawText = await res.text();
  let data: T = undefined as T;
  try {
    data = (rawText ? JSON.parse(rawText) : {}) as T;
  } catch {
    data = { raw: rawText } as T;
  }

  return { ok: res.ok, status: res.status, data, rawText };
}
