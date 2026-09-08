import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateUserRequest } from "@namera-ai/protocol/dto";
import { expect, it } from "vitest";

import { profileFormValues } from "../../src/routes/_authenticated/settings/-components/profile-form/values";

it("accepts a name edit for a profile without an uploaded image", async () => {
  const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(UpdateUserRequest));
  const result = await resolve(
    profileFormValues({ metadata: { version: 1, name: "Browser tester" } }),
    undefined,
    { fields: {}, shouldUseNativeValidation: false },
  );
  expect(result.errors).toEqual({});
  expect(result.values).toMatchObject({ metadata: { name: "Browser tester" } });
});

it("preserves an existing profile image", () => {
  const metadata = {
    version: 1 as const,
    name: "Tester",
    image: { type: "image" as const, value: "https://example.com/avatar.png" },
  };
  expect(profileFormValues({ metadata })).toEqual({ metadata });
});
