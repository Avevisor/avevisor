import { NextResponse } from "next/server";

import { getDataApiKey, getDelegateCredentials } from "@/server/env";

/**
 * GET /api/health — configuration probe (no secrets exposed).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    hasDelegateKeys: Boolean(getDelegateCredentials()),
    hasDataApiKey: Boolean(getDataApiKey()),
    hasHermesUrl: Boolean(process.env.HERMES_API_URL),
  });
}
