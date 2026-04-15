import type { DelegateCredentials } from "./delegate-http";
import { delegateFetch } from "./delegate-http";

export interface AveEnvelope<T> {
  status: number;
  msg: string;
  data: T;
}

export interface TransferBody {
  chain: string;
  assetsId: string;
  fromAddress: string;
  toAddress: string;
  tokenAddress: string;
  amount: string;
  gas?: string;
  extraGas?: string;
}

/**
 * Sends a delegate-wallet transfer (API-created delegate wallets only).
 */
export async function sendTransfer(params: {
  credentials: DelegateCredentials;
  body: TransferBody;
}): Promise<AveEnvelope<{ id: string }[]>> {
  const res = await delegateFetch<AveEnvelope<{ id: string }[]>>({
    credentials: params.credentials,
    method: "POST",
    path: "/v1/thirdParty/tx/transfer",
    body: params.body as unknown as Record<string, unknown>,
  });
  return res.data;
}
