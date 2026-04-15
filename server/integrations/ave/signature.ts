import crypto from "node:crypto";

/**
 * RFC3339Nano-style UTC timestamp used in AVE-ACCESS-TIMESTAMP header.
 */
export function createAveAccessTimestamp(): string {
  const d = new Date();
  return d.toISOString().replace(/\.\d{3}Z$/, (m) => {
    const frac = m.slice(1, -1);
    return `.${frac.padEnd(9, "0")}Z`;
  });
}

/**
 * Canonical JSON for signing: sorted keys, no spaces (matches AVE docs).
 */
export function canonicalJsonString(body: Record<string, unknown>): string {
  return JSON.stringify(sortKeysDeep(body));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeysDeep(obj[key]);
  }
  return sorted;
}

/**
 * Builds the string signed by HMAC-SHA256:
 * timestamp + METHOD + requestPath + body (POST only; minified sorted JSON or trimmed string).
 * GET query params are NOT part of the signature per AVE delegate docs.
 */
export function buildSignatureMessage(params: {
  timestamp: string;
  method: string;
  requestPath: string;
  body?: Record<string, unknown> | string | null;
}): string {
  const method = params.method.toUpperCase().trim();
  const path = params.requestPath.trim();
  let message = `${params.timestamp}${method}${path}`;
  if (params.body === undefined || params.body === null) return message;
  if (typeof params.body === "string") message += params.body.trim();
  else message += canonicalJsonString(params.body);
  return message;
}

/**
 * Produces Base64 HMAC-SHA256 signature for delegate wallet REST calls.
 */
export function signAveDelegateRequest(params: {
  apiSecret: string;
  method: string;
  requestPath: string;
  body?: Record<string, unknown> | string | null;
  timestamp?: string;
}): { signature: string; timestamp: string } {
  const timestamp = params.timestamp ?? createAveAccessTimestamp();
  const message = buildSignatureMessage({
    timestamp,
    method: params.method,
    requestPath: params.requestPath,
    body: params.body ?? null,
  });
  const hmac = crypto.createHmac("sha256", params.apiSecret);
  hmac.update(message, "utf8");
  const signature = hmac.digest("base64");
  return { signature, timestamp };
}
