/**
 * Base URLs and default path segments for AVE Bot (delegate) and Cloud Data APIs.
 * Override via environment variables when your account uses different hosts.
 */
export const DELEGATE_API_BASE =
  process.env.AVE_DELEGATE_API_BASE ?? "https://bot-api.ave.ai";

export const DATA_API_BASE =
  process.env.AVE_DATA_API_BASE ?? "https://prod.ave-api.com";

/** JSON-RPC delegate wallet WebSocket base (query param ave_access_key added by client). */
export const DELEGATE_WS_BASE =
  process.env.AVE_DELEGATE_WS_BASE ?? "wss://bot-api.ave.ai/thirdws";

/**
 * Market swap submission path (POST). Confirm in AVE docs if your tier differs.
 * @see https://docs-bot-api.ave.ai/en/delegate-wallet-transaction-rest-api/trading.md
 */
export const DELEGATE_TX_SWAP_PATH =
  process.env.AVE_DELEGATE_TX_SWAP_PATH ?? "/v1/thirdParty/tx/swap";
