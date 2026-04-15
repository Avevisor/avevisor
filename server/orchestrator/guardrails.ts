/**
 * Execution policy for protected Trader / Wallet nodes (server-side only).
 */
export interface ExecutionPolicy {
  /** When true, Trader node does not call AVE swap (returns simulated order id). */
  dryRun: boolean;
  /** User must pass confirmLive=true on the run request for real trades. */
  confirmLive: boolean;
  /** Maximum inAmount (string compare as bigint — same decimal unit as token). */
  maxInAmount?: string;
  /** Allowed chains for trades. */
  allowedChains: string[];
  /** Optional token allowlist (lowercase addresses). Empty = disabled. */
  allowedTokenAddresses: string[];
}

export const defaultExecutionPolicy: ExecutionPolicy = {
  /** Default safe: dry-run unless AVE_TRADER_DRY_RUN=false */
  dryRun: process.env.AVE_TRADER_DRY_RUN !== "false",
  confirmLive: false,
  maxInAmount: process.env.AVE_MAX_IN_AMOUNT,
  allowedChains: (process.env.AVE_ALLOWED_CHAINS ?? "solana,bsc,base,eth")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  allowedTokenAddresses: (process.env.AVE_ALLOWED_TOKENS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};

/**
 * Validates trader config against policy before submitting to AVE.
 */
export function assertTraderAllowed(params: {
  policy: ExecutionPolicy;
  chain: string;
  inTokenAddress: string;
  outTokenAddress: string;
  inAmount: string;
  userConfirmedLive: boolean;
}): void {
  if (!params.policy.allowedChains.includes(params.chain)) {
    throw new Error(`Chain not allowed: ${params.chain}`);
  }
  const allow = params.policy.allowedTokenAddresses;
  if (allow.length > 0) {
    const a = params.inTokenAddress.toLowerCase();
    const b = params.outTokenAddress.toLowerCase();
    if (!allow.includes(a) && !allow.includes(b)) {
      throw new Error("Token pair not in allowlist (set AVE_ALLOWED_TOKENS).");
    }
  }
  if (params.policy.maxInAmount) {
    try {
      const max = BigInt(params.policy.maxInAmount);
      const amt = BigInt(params.inAmount);
      if (amt > max) throw new Error("inAmount exceeds AVE_MAX_IN_AMOUNT");
    } catch (e) {
      if (e instanceof Error && e.message.includes("exceeds")) throw e;
      throw new Error("Invalid inAmount for policy check");
    }
  }
  if (!params.policy.dryRun && !params.userConfirmedLive) {
    throw new Error(
      "Live trading requires confirmLive=true on the run request.",
    );
  }
}
