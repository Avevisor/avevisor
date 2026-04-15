import type { DelegateCredentials } from "./delegate-http";
import { delegateFetch } from "./delegate-http";

/** Response shape from AVE delegate user APIs (partial). */
export interface DelegateUserRecord {
  assetsId: string;
  assetsName?: string;
  type?: string;
  status?: string;
  addressList?: Array<{ chain: string; address: string }>;
}

export interface AveEnvelope<T> {
  status: number;
  msg: string;
  data: T;
}

/**
 * Creates a delegate wallet via AVE API (Level 1+ account required).
 */
export async function generateWallet(params: {
  credentials: DelegateCredentials;
  assetsName: string;
  returnMnemonic?: boolean;
}): Promise<AveEnvelope<DelegateUserRecord[]>> {
  const res = await delegateFetch<AveEnvelope<DelegateUserRecord[]>>({
    credentials: params.credentials,
    method: "POST",
    path: "/v1/thirdParty/user/generateWallet",
    body: {
      assetsName: params.assetsName,
      ...(params.returnMnemonic !== undefined
        ? { returnMnemonic: params.returnMnemonic }
        : {}),
    },
  });
  return res.data;
}

/**
 * Queries delegate users by optional assetsIds (comma-separated).
 */
export async function getUserByAssetsId(params: {
  credentials: DelegateCredentials;
  assetsIds?: string;
}): Promise<AveEnvelope<DelegateUserRecord[]>> {
  const res = await delegateFetch<AveEnvelope<DelegateUserRecord[]>>({
    credentials: params.credentials,
    method: "GET",
    path: "/v1/thirdParty/user/getUserByAssetsId",
    searchParams: params.assetsIds
      ? { assetsIds: params.assetsIds }
      : undefined,
  });
  return res.data;
}
