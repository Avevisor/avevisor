import { DATA_API_BASE } from "./constants";

/**
 * Reads Cloud Data REST with X-API-KEY (not delegate HMAC).
 */
export async function dataApiFetch<T = unknown>(params: {
  apiKey: string;
  path: string;
  searchParams?: Record<string, string | number | undefined>;
  init?: RequestInit;
}): Promise<{ ok: boolean; status: number; data: T }> {
  const url = new URL(params.path, DATA_API_BASE);
  if (params.searchParams) {
    for (const [k, v] of Object.entries(params.searchParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    ...params.init,
    headers: {
      "X-API-KEY": params.apiKey,
      Accept: "application/json",
      ...params.init?.headers,
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/** Token search GET /v2/tokens */
export async function searchTokens(params: {
  apiKey: string;
  keyword: string;
  chain?: string;
  limit?: number;
}): Promise<unknown> {
  const r = await dataApiFetch({
    apiKey: params.apiKey,
    path: "/v2/tokens",
    searchParams: {
      keyword: params.keyword,
      chain: params.chain,
      limit: params.limit,
    },
  });
  return r.data;
}

/** GET /v2/tokens/{token-id} */
export async function getTokenDetail(params: {
  apiKey: string;
  tokenId: string;
}): Promise<unknown> {
  const r = await dataApiFetch({
    apiKey: params.apiKey,
    path: `/v2/tokens/${encodeURIComponent(params.tokenId)}`,
  });
  return r.data;
}

/** GET /v2/klines/token/{token-id} */
export async function getTokenKlines(params: {
  apiKey: string;
  tokenId: string;
  interval: number;
  limit?: number;
}): Promise<unknown> {
  const r = await dataApiFetch({
    apiKey: params.apiKey,
    path: `/v2/klines/token/${encodeURIComponent(params.tokenId)}`,
    searchParams: {
      interval: params.interval,
      limit: params.limit,
    },
  });
  return r.data;
}

/** GET /v2/address/walletinfo */
export async function getWalletInfo(params: {
  apiKey: string;
  walletAddress: string;
  chain: string;
}): Promise<unknown> {
  const r = await dataApiFetch({
    apiKey: params.apiKey,
    path: "/v2/address/walletinfo",
    searchParams: {
      wallet_address: params.walletAddress,
      chain: params.chain,
    },
  });
  return r.data;
}
