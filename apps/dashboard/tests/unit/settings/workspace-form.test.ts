import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateOrganizationRequest } from "@namera-ai/protocol/dto";
import { expect, it } from "vitest";

import { workspaceFormValues } from "../../../src/routes/_authenticated/settings/-components/workspace-form-values";

it("accepts workspace name edits without an existing logo", async () => {
  const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(UpdateOrganizationRequest));
  const result = await resolve(
    workspaceFormValues({ metadata: { version: 1, name: "Workspace" } }),
    undefined,
    { fields: {}, shouldUseNativeValidation: false },
  );
  expect(result.errors).toEqual({});
  expect(result.values).toMatchObject({
    metadata: { name: "Workspace", logo: { type: "emoji", value: "🏢" } },
  });
});

it("preserves the workspace logo and description", () => {
  const metadata = {
    version: 1 as const,
    name: "Workspace",
    description: "Team",
    logo: { type: "emoji" as const, value: "🌍" },
  };
  expect(workspaceFormValues({ metadata })).toEqual({ metadata });
});
