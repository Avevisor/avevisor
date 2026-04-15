import { describe, expect, it } from "vitest";

import { coerceNodeConfig, getDefaultNodeConfig } from "./contracts";

describe("node settings contracts", () => {
  it("fills defaults for empty supervisor config", () => {
    const config = getDefaultNodeConfig("supervisor");
    expect(config.objective).toBe("Coordinate AVE trading workflow");
    expect(config.runMode).toBe("manual");
    expect(config.enabled).toBe(true);
  });

  it("coerces partial trader config with defaults", () => {
    const config = coerceNodeConfig("trader", {
      chain: "solana",
      assetsId: "asset-1",
      inTokenAddress: "sol",
      outTokenAddress: "token",
      inAmount: "1000000",
      swapType: "buy",
      slippageBps: "250",
      useMev: true,
    });
    expect(config.swapType).toBe("buy");
    expect(config.requireApprovalBeforeLiveOrders).toBe(true);
    expect(config.validateBalanceBeforeOrder).toBe(true);
  });

  it("rejects invalid enum values", () => {
    expect(() =>
      coerceNodeConfig("trader", {
        chain: "solana",
        assetsId: "asset-1",
        inTokenAddress: "sol",
        outTokenAddress: "token",
        inAmount: "1000000",
        swapType: "hold",
        slippageBps: "250",
        useMev: true,
      }),
    ).toThrowError();
  });

  it("normalizes minimal legacy monitor config", () => {
    const config = coerceNodeConfig("monitor", { chain: "bsc" });
    expect(config.chain).toBe("bsc");
    expect(config.pollIntervalSec).toBe(30);
    expect(config.mode).toBe("polling");
    expect(config.sendToSupervisor).toBe(true);
  });
});
