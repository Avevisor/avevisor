import WebSocket from "ws";

import { DELEGATE_WS_BASE } from "@/server/integrations/ave/constants";

export interface BotswapMessage {
  topic?: string;
  msg?: {
    id?: string;
    status?: string;
    chain?: string;
    assetsId?: string;
    orderType?: string;
    swapType?: string;
    errorMessage?: string;
    txHash?: string;
    autoSellTriggerHash?: string;
  };
}

/**
 * Subscribes to delegate wallet `botswap` pushes until `orderId` matches or timeout.
 */
export function waitForBotswapOrder(params: {
  accessKey: string;
  orderId: string;
  timeoutMs?: number;
}): Promise<BotswapMessage["msg"]> {
  const timeoutMs = params.timeoutMs ?? 120_000;
  const url = `${DELEGATE_WS_BASE}?ave_access_key=${encodeURIComponent(params.accessKey)}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`botswap timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }

    ws.on("open", () => {
      const sub = {
        jsonrpc: "2.0",
        method: "subscribe",
        params: ["botswap"],
        id: 0,
      };
      ws.send(JSON.stringify(sub));
    });

    ws.on("message", (data: WebSocket.RawData) => {
      try {
        const text = data.toString();
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const result = parsed.result as Record<string, unknown> | undefined;
        const topic = result?.topic as string | undefined;
        const msg = result?.msg as BotswapMessage["msg"] | undefined;
        if (topic === "botswap" && msg?.id === params.orderId) {
          cleanup();
          resolve(msg);
        }
      } catch {
        /* ignore malformed */
      }
    });

    ws.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}
