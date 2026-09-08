import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { describe, expect, it } from "vitest";

import {
  SignaturePolicyForm,
  toSignatureFormInput,
} from "../../src/components/policy/evm/signature-form";

const rule = {
  chainId: "eip155:1" as const,
  verifyingContract: "0x1111111111111111111111111111111111111111",
  name: "",
  version: "",
  matchName: false,
  matchVersion: false,
  primaryTypes: "Permit, Authorization",
};
const decode = Schema.decodeUnknownSync(SignaturePolicyForm);

describe("signature policy form", () => {
  it("maps duplicate-type errors to the visible field through the form resolver", async () => {
    const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(SignaturePolicyForm));
    const result = await resolve(
      { allowedTypes: ["typed-data"], rules: [{ ...rule, primaryTypes: "Permit, Permit" }] },
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    expect(result.errors).toMatchObject({
      rules: [{ primaryTypes: { message: "Message types must be unique" } }],
    });
  });
  it("requires restrictions for typed data but not for messages", () => {
    expect(() => decode({ allowedTypes: ["typed-data"], rules: [] })).toThrow();
    expect(decode({ allowedTypes: ["message"], rules: [] })).toEqual({
      type: "evm.signature",
      version: 1,
      allowedTypes: ["message"],
    });
  });
  it("maps comma-separated types and omits unrestricted domain fields", () => {
    const policy = decode({ allowedTypes: ["typed-data"], rules: [rule] });
    expect(policy.typedDataRules).toEqual([
      {
        chainId: rule.chainId,
        verifyingContract: rule.verifyingContract,
        primaryTypes: ["Permit", "Authorization"],
      },
    ]);
    expect(decode(toSignatureFormInput(policy))).toEqual(policy);
  });
  it("preserves exact empty and nonempty domain restrictions when editing", () => {
    for (const name of ["", "Namera"]) {
      const policy = decode({
        allowedTypes: ["typed-data"],
        rules: [{ ...rule, name, matchName: true, matchVersion: true }],
      });
      expect(policy.typedDataRules?.[0]).toMatchObject({ name, version: "" });
      expect(decode(toSignatureFormInput(policy))).toEqual(policy);
      expect(decode(Schema.encodeSync(SignaturePolicyForm)(policy))).toEqual(policy);
    }
  });
  it("rejects invalid contracts and duplicate message types", () => {
    expect(() =>
      decode({ allowedTypes: ["typed-data"], rules: [{ ...rule, verifyingContract: "bad" }] }),
    ).toThrow();
    expect(() =>
      decode({
        allowedTypes: ["typed-data"],
        rules: [{ ...rule, primaryTypes: "Permit, Permit" }],
      }),
    ).toThrow();
  });
});
