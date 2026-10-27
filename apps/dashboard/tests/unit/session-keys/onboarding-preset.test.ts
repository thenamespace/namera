import { Schema } from "effect";

import { usdcAllowanceTemplate } from "@namera-ai/templates";
import { describe, expect, it } from "vitest";

import { createSessionKeyInitialValues } from "../../../src/components/session-key-creation/initial-values";
import { CreateSessionKeyFormSchema } from "../../../src/components/session-key-creation/schema";
import {
  validateSessionCreationSearch,
  validateSessionCreationSource,
} from "../../../src/routes/_authenticated/session-keys/-components/creation-search";
import {
  frozenSessionAccount,
  newestSessionAccount,
  olderSessionAccount,
  sessionPresetAccounts,
} from "../../fixtures/session-key-preset";

const nowSeconds = 1_800_000_000;

describe("onboarding session preset", () => {
  it("prefills a valid Base-only session with message signing and unrestricted access for 30 days", () => {
    const initial = createSessionKeyInitialValues(
      sessionPresetAccounts,
      { onboarding: true },
      nowSeconds,
    );
    const decoded = Schema.decodeUnknownSync(CreateSessionKeyFormSchema)(initial);
    expect(decoded.walletId).toBe(newestSessionAccount.id);
    expect(decoded.metadata.name).toBe("My first session key");
    expect(decoded.custody).toBe("namera-managed");
    expect(decoded.onchain.installations).toEqual([
      {
        chainId: "eip155:8453",
        validAfter: 0,
        validUntil: nowSeconds + 2_592_000,
        allowSignatures: true,
        permissions: [{ type: "root" }],
      },
    ]);
    expect(decoded.policies).toEqual([
      { type: "evm.signature", version: 1, allowedTypes: ["message"] },
    ]);
  });

  it("selects the newest active account independently of response ordering", () => {
    for (const accounts of [sessionPresetAccounts, sessionPresetAccounts.toReversed()]) {
      expect(
        createSessionKeyInitialValues(accounts, { onboarding: true }, nowSeconds).walletId,
      ).toBe(newestSessionAccount.id);
    }
  });

  it("keeps account selection empty if no eligible account exists", () => {
    expect(
      createSessionKeyInitialValues([frozenSessionAccount], { onboarding: true }, nowSeconds)
        .walletId,
    ).toBe("");
  });

  it("preserves explicit account selection and ordinary defaults without the preset", () => {
    const initial = createSessionKeyInitialValues(
      sessionPresetAccounts,
      { initialAccountId: olderSessionAccount.id },
      nowSeconds,
    );
    expect(initial.walletId).toBe(olderSessionAccount.id);
    expect(initial.metadata.name).toBe("");
    expect(initial.policies).toEqual([]);
    expect(initial.onchain.installations).toEqual([
      {
        chainId: "eip155:1",
        validAfter: 0,
        validUntil: nowSeconds + 2_592_000,
        permissions: [],
        allowSignatures: false,
      },
    ]);
  });

  it("does not add onboarding authority to template defaults", () => {
    const initial = createSessionKeyInitialValues(
      sessionPresetAccounts,
      { onboarding: true, template: usdcAllowanceTemplate },
      nowSeconds,
    );
    expect(initial.policies).toEqual([]);
    expect(initial.onchain.installations[0]?.permissions).toEqual([]);
    expect(initial.metadata.logo).toEqual(usdcAllowanceTemplate.metadata.logo);
  });

  it("accepts only the known preset and preserves a valid account identifier", () => {
    expect(
      validateSessionCreationSearch({ preset: "get-started", accountId: olderSessionAccount.id }),
    ).toEqual({ preset: "get-started", accountId: olderSessionAccount.id });
    expect(validateSessionCreationSearch({ preset: "full-access", accountId: "invalid" })).toEqual(
      {},
    );
  });

  it("allowlists the return source independently of the one-time preset", () => {
    expect(validateSessionCreationSearch({ from: "get-started" })).toEqual({ from: "get-started" });
    expect(validateSessionCreationSource({ from: "get-started", preset: "get-started" })).toEqual({
      from: "get-started",
    });
    expect(validateSessionCreationSource({ from: "https://untrusted.example" })).toEqual({});
  });
});
