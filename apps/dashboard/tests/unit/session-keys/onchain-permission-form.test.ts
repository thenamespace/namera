import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { describe, expect, it } from "vitest";

import { OnchainPermissionForm } from "../../../src/components/policy/evm/onchain/catalog";

const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(OnchainPermissionForm));
const options = { fields: {}, shouldUseNativeValidation: false };

describe("onchain permission form boundary", () => {
  it("preserves root consent failures through the form resolver", async () => {
    const rejected = await resolve(
      { permission: { type: "root" }, acknowledgeRoot: false },
      undefined,
      options,
    );
    expect(rejected.errors).toHaveProperty("acknowledgeRoot.message");
    expect(rejected.values).toEqual({});
    const accepted = await resolve(
      { permission: { type: "root" }, acknowledgeRoot: true },
      undefined,
      options,
    );
    expect(accepted.errors).toEqual({});
    expect(accepted.values).toEqual({ permission: { type: "root" }, acknowledgeRoot: true });
  });

  it("rejects negative spend and preserves exact integer base units", async () => {
    const rejected = await resolve(
      { permission: { type: "native-token-transfer", allowance: "-1" }, acknowledgeRoot: false },
      undefined,
      options,
    );
    expect(Object.keys(rejected.errors).length).toBeGreaterThan(0);
    const accepted = await resolve(
      {
        permission: { type: "native-token-transfer", allowance: "10000000000000001" },
        acknowledgeRoot: false,
      },
      undefined,
      options,
    );
    expect(accepted.errors).toEqual({});
    expect(accepted.values).toEqual({
      permission: { type: "native-token-transfer", allowance: 10000000000000001n },
      acknowledgeRoot: false,
    });
  });
});
