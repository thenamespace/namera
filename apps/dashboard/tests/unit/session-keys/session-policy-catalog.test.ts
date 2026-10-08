import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { describe, expect, it } from "vitest";

import {
  hasTransactionAccess,
  policyChoiceFor,
  policyUnavailableReason,
  sessionPolicyCatalog,
  permissionConflict,
} from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/policies/catalog";
import { ContractAccessForm } from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/policies/contract-access/form";
import {
  NativeBudgetForm,
  nativeBudgetAmount,
  toNativeBudgetPermission,
} from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/policies/native-budget/form";
import { signatureConfiguration } from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/policies/signature-configuration";

const address = "0x1111111111111111111111111111111111111111";
const options = { fields: {}, shouldUseNativeValidation: false };
const resolveContract = standardSchemaResolver(Schema.toStandardSchemaV1(ContractAccessForm));

describe("beta session policies", () => {
  it("offers six capabilities, with contract modes sharing one picker entry", () => {
    expect(sessionPolicyCatalog.map((entry) => entry.id)).toEqual([
      "contract-access",
      "erc20-token-transfer",
      "native-token-transfer",
      "gas-limit",
      "signature",
      "root",
    ]);
    for (const mode of [
      "contract-access",
      "functions-on-contract",
      "functions-on-all-contracts",
    ] as const)
      expect(policyChoiceFor(mode).id).toBe("contract-access");
  });

  it("serializes each contract mode and ignores irrelevant hidden drafts", async () => {
    const draft = { address, functions: "0xa9059cbb,\n0x095ea7b3\n" };
    await Promise.all(
      (["contract-access", "functions-on-contract", "functions-on-all-contracts"] as const).map(
        async (type) => {
          const result = await resolveContract({ ...draft, type }, undefined, options);
          expect(result.errors).toEqual({});
          expect(result.values).toEqual({
            type,
            ...(type !== "functions-on-all-contracts" ? { address } : {}),
            ...(type !== "contract-access" ? { functions: ["0xa9059cbb", "0x095ea7b3"] } : {}),
          });
        },
      ),
    );
    expect(
      (
        await resolveContract(
          { type: "contract-access", address, functions: "invalid hidden draft" },
          undefined,
          options,
        )
      ).errors,
    ).toEqual({});
    expect(
      (
        await resolveContract(
          {
            type: "functions-on-all-contracts",
            address: "invalid hidden draft",
            functions: "0xa9059cbb",
          },
          undefined,
          options,
        )
      ).errors,
    ).toEqual({});
  });

  it.each(["", "0x12", "0xa9059cbb\n0xA9059CBB", "not a selector"])(
    "rejects invalid/duplicate selected functions: %s",
    async (functions) => {
      expect(
        (
          await resolveContract(
            { type: "functions-on-contract", address, functions },
            undefined,
            options,
          )
        ).errors,
      ).not.toEqual({});
    },
  );

  it("rejects invalid target addresses", async () => {
    expect(
      (
        await resolveContract(
          { type: "contract-access", address: "bad", functions: "" },
          undefined,
          options,
        )
      ).errors,
    ).not.toEqual({});
  });

  it("rejects repeated targets across grant types and duplicate wildcard rules", () => {
    const target = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    expect(
      permissionConflict(
        {
          type: "functions-on-contract",
          address: "0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD",
          functions: ["0xa9059cbb"],
        },
        [{ type: "contract-access", address: target }],
      ),
    ).toBeDefined();
    expect(
      permissionConflict({ type: "contract-access", address }, [
        { type: "contract-access", address: target },
      ]),
    ).toBeUndefined();
    expect(
      permissionConflict({ type: "functions-on-all-contracts", functions: ["0xa9059cbb"] }, [
        { type: "functions-on-all-contracts", functions: ["0x095ea7b3"] },
      ]),
    ).toBeDefined();
  });

  it("keeps root exclusive without blocking signatures and permits repeatable contracts", () => {
    expect(
      policyUnavailableReason(
        policyChoiceFor("gas-limit"),
        [{ type: "gas-limit", limit: "100" }],
        false,
      ),
    ).toBe("Already added");
    expect(
      policyUnavailableReason(
        policyChoiceFor("contract-access"),
        [{ type: "contract-access", address }],
        false,
      ),
    ).toBeUndefined();
    expect(
      policyUnavailableReason(
        policyChoiceFor("root"),
        [{ type: "gas-limit", limit: "100" }],
        false,
      ),
    ).toBeDefined();
    expect(
      policyUnavailableReason(policyChoiceFor("gas-limit"), [{ type: "root" }], false),
    ).toBeDefined();
    expect(
      policyUnavailableReason(policyChoiceFor("signature"), [{ type: "root" }], false),
    ).toBeUndefined();
    expect(policyUnavailableReason(policyChoiceFor("signature"), [], true)).toBe("Already added");
    expect(
      permissionConflict({ type: "root" }, [{ type: "contract-access", address }]),
    ).toBeDefined();
  });

  it("does not mistake limits for access", () => {
    expect(hasTransactionAccess([{ type: "gas-limit" }, { type: "native-token-transfer" }])).toBe(
      false,
    );
    expect(hasTransactionAccess([{ type: "erc20-token-transfer" }])).toBe(true);
    expect(hasTransactionAccess([{ type: "root" }])).toBe(true);
  });

  it("adds and removes both signature requirements together", () => {
    const policy = { type: "evm.signature", version: 1, allowedTypes: ["message"] } as const;
    expect(signatureConfiguration(policy)).toEqual({ policies: [policy], allowSignatures: true });
    expect(signatureConfiguration()).toEqual({ policies: [], allowSignatures: false });
  });

  it("converts human native budgets without losing precision", () => {
    const amount = "0.010000000000000001";
    expect(toNativeBudgetPermission("gas-limit", amount)).toEqual({
      type: "gas-limit",
      limit: "10000000000000001",
    });
    expect(nativeBudgetAmount(toNativeBudgetPermission("native-token-transfer", amount))).toBe(
      amount,
    );
    const decode = Schema.decodeUnknownSync(NativeBudgetForm);
    expect(decode({ amount: "0" })).toEqual({ amount: "0" });
    for (const invalid of ["", "-1", "1e6", "0.0000000000000000001", "9".repeat(80)])
      expect(() => decode({ amount: invalid })).toThrow();
  });
});
