import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { describe, expect, it } from "vitest";

import { SessionExportForm } from "../../src/routes/_authenticated/session-keys/-components/create-session-key-form/export-schema";

const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(SessionExportForm));
const options = { fields: {}, shouldUseNativeValidation: false };

describe("session export passphrase form", () => {
  it("rejects a short passphrase and attaches confirmation mismatches to the field", async () => {
    const short = await resolve({ password: "short", confirmation: "short" }, undefined, options);
    expect(short.errors).toHaveProperty("password.message");
    const mismatch = await resolve(
      { password: "test-only long passphrase", confirmation: "different" },
      undefined,
      options,
    );
    expect(mismatch.errors).toHaveProperty("confirmation.message");
    expect(mismatch.values).toEqual({});
  });

  it("preserves an explicitly confirmed passphrase without trimming it", async () => {
    const input = {
      password: " test-only long passphrase ",
      confirmation: " test-only long passphrase ",
    };
    const result = await resolve(input, undefined, options);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual(input);
  });
});
