import { DELEGATE_TX_SWAP_PATH } from "./constants";
import type { DelegateCredentials } from "./delegate-http";
import { delegateFetch } from "./delegate-http";

export interface AveEnvelope<T> {
  status: number;
  msg: string;
  data: T;
}

/** Market/limit swap request fields (delegate wallet) — align with AVE trading docs. */
export interface SendSwapBody {
  chain: string;
  assetsId: string;
  inTokenAddress: string;
  outTokenAddress: string;
  inAmount: string;
  swapType: "buy" | "sell";
  slippage: string;
  useMev: boolean;
  gas?: string;
  extraGas?: string;
  limitPrice?: string;
  expireTime?: string;
  autoSlippage?: boolean;
  autoGas?: string;
}

/**
 * Submits a swap order on the delegate wallet (path configurable via env).
 */
export async function sendSwapOrder(params: {
  credentials: DelegateCredentials;
  body: SendSwapBody;
}): Promise<AveEnvelope<{ id: string }[] | { id: string }>> {
  const res = await delegateFetch<
    AveEnvelope<{ id: string }[] | { id: string }>
  >({
    credentials: params.credentials,
    method: "POST",
    path: DELEGATE_TX_SWAP_PATH,
    body: params.body as unknown as Record<string, unknown>,
  });
  return res.data;
}

/**
 * Polls swap/transfer order status by ids (comma-separated).
 * Uses getTransfer for transfer orders; many deployments share the same pattern for swap — confirm in your AVE console.
 */
export async function getTransferStatus(params: {
  credentials: DelegateCredentials;
  chain: string;
  ids: string;
}): Promise<AveEnvelope<unknown>> {
  const res = await delegateFetch<AveEnvelope<unknown>>({
    credentials: params.credentials,
    method: "GET",
    path: "/v1/thirdParty/tx/getTransfer",
    searchParams: { chain: params.chain, ids: params.ids },
  });
  return res.data;
}
