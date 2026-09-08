import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { describe, expect, it } from "vitest";

import {
  CreateAccountFormValues,
  defaultAccountValues,
} from "../../src/routes/_authenticated/accounts/-components/create-account-schema";

const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(CreateAccountFormValues));
const options = { fields: {}, shouldUseNativeValidation: false };

describe("account creation form", () => {
  it("accepts a name without a description after recovery acknowledgement", async () => {
    const values = {
      acknowledgeRecovery: true,
      metadata: { ...defaultAccountValues.metadata, name: "Treasury" },
    };
    expect(values.metadata.description).toBe("");
    const result = await resolve(values, undefined, options);
    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({ metadata: { name: "Treasury" } });
    expect(result.values).not.toHaveProperty("metadata.description");
  });

  it("accepts a cleared description but still rejects an empty name", async () => {
    const result = await resolve(
      {
        acknowledgeRecovery: true,
        metadata: { ...defaultAccountValues.metadata, name: "Treasury", description: "" },
      },
      undefined,
      options,
    );
    expect(result.errors).toEqual({});
    const invalid = await resolve(defaultAccountValues, undefined, options);
    expect(invalid.errors).toHaveProperty("metadata.name");
  });

  it("blocks creation when the recovery limitation is not acknowledged", async () => {
    const result = await resolve(
      { ...defaultAccountValues, metadata: { ...defaultAccountValues.metadata, name: "Treasury" } },
      undefined,
      options,
    );
    expect(result.errors).toHaveProperty("acknowledgeRecovery");
    expect(result.values).toEqual({});
  });
});
