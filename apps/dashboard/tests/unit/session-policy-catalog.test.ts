import { describe, expect, it } from "vitest";

import {
  isOnchainChoiceUnavailable,
  sessionPolicyCatalog,
  permissionConflict,
} from "../../src/routes/_authenticated/session-keys/-components/create-session-key-form/policies/catalog";
import {
  toOnchainLifetime,
  toTimeWindowPolicy,
} from "../../src/routes/_authenticated/session-keys/-components/create-session-key-form/policies/lifetime";
import {
  toSharedPermission,
  toOffchainPermission,
} from "../../src/routes/_authenticated/session-keys/-components/create-session-key-form/policies/shared-permission";

describe("unified session policies", () => {
  it("preserves shared contract fields when changing enforcement", () => {
    const policy = {
      type: "evm.functions-on-contract",
      version: 1,
      address: "0x1111111111111111111111111111111111111111",
      functions: ["0xa9059cbb"],
    } as const;
    const shared = toSharedPermission(policy);
    expect(shared).toMatchObject({
      type: "functions-on-contract",
      address: policy.address,
      functions: policy.functions,
    });
    expect(shared && toOffchainPermission(shared)).toEqual(policy);
    expect(toOffchainPermission({ type: "gas-limit", limit: "100" })).toBeUndefined();
  });
  it("offers overlapping rules once with distinct enforcement choices", () => {
    for (const [api, onchain] of [
      ["evm.time-window", "time-window"],
      ["evm.native-spend-limit", "native-token-transfer"],
      ["evm.gas-budget", "gas-limit"],
      ["evm.signature", "signature"],
      ["evm.contract-access", "contract-access"],
      ["evm.functions-on-contract", "functions-on-contract"],
      ["evm.functions-on-all-contracts", "functions-on-all-contracts"],
      ["evm.account-functions", "account-functions"],
      ["evm.erc20-token-transfer", "erc20-token-transfer"],
    ]) {
      const choices = sessionPolicyCatalog.filter(
        (choice) => choice.api === api || choice.onchain === onchain,
      );
      expect(choices).toHaveLength(1);
      expect(choices[0]).toMatchObject({ api, onchain });
    }
  });

  it("rejects duplicate targets across grant types but permits another target", () => {
    const address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const existing = [{ type: "contract-access", address }] as const;
    expect(
      permissionConflict(
        {
          type: "functions-on-contract",
          address: "0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD",
          functions: ["0xa9059cbb"],
        },
        existing,
      ),
    ).toBeDefined();
    expect(
      permissionConflict(
        { type: "contract-access", address: "0x1111111111111111111111111111111111111111" },
        existing,
      ),
    ).toBeUndefined();
    expect(permissionConflict(existing[0], [])).toBeUndefined();
  });

  it("prevents duplicate singleton grants and root combinations without blocking target-specific rules", () => {
    expect(isOnchainChoiceUnavailable("gas-limit", ["gas-limit"], false)).toBe(true);
    expect(isOnchainChoiceUnavailable("contract-access", ["contract-access"], false)).toBe(false);
    expect(isOnchainChoiceUnavailable("root", ["contract-access"], false)).toBe(true);
    expect(isOnchainChoiceUnavailable("contract-access", ["root"], false)).toBe(true);
    expect(isOnchainChoiceUnavailable("signature", [], true)).toBe(true);
    expect(isOnchainChoiceUnavailable("time-window", ["root"], false)).toBe(false);
  });

  it("round trips lifetime seconds without changing the instant or immediate-start sentinel", () => {
    for (const validAfter of [0, 1_900_000_000]) {
      const validUntil = 2_000_000_000;
      expect(toOnchainLifetime(toTimeWindowPolicy(validAfter, validUntil))).toEqual({
        validAfter,
        validUntil,
      });
    }
    expect(toTimeWindowPolicy(0, 0)).toMatchObject({ startsAt: null, expiresAt: "" });
  });
});
