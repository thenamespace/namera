import { Schema } from "effect";

import { MetadataIcon, OrganizationId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const OrganizationSlug = Schema.String.pipe(
  Schema.brand("OrganizationSlug"),
).check(
  Schema.isPattern(/^[a-zA-Z0-9-]+$/, {
    message: "Slug must be alphanumeric and can contain hyphens",
  }),
  Schema.isLengthBetween(3, 63, {
    message: "Slug must be between 3 and 63 characters long",
  }),
);

export const OrganizationMetadata = Schema.Struct({
  name: Schema.String.check(
    Schema.isPattern(/^[a-zA-Z0-9-_]+$/, {
      message:
        "Name must be alphanumeric and can contain hyphens and underscores",
    }),
    Schema.isLengthBetween(3, 128, {
      message: "Name must be between 3 and 128 characters long",
    }),
  ),
  logo: MetadataIcon,
});

export const OrganizationPlan = Schema.Literals(["free"]);

export const Organization = Schema.Struct({
  id: OrganizationId,
  metadata: Schema.NullOr(OrganizationMetadata),
  plan: OrganizationPlan,
  slug: OrganizationSlug,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const OrganizationUpdate = createUpdateSchema(Organization);
export const OrganizationInsert = createInsertSchema(
  Organization,
  "metadata",
  "plan",
  "slug",
);

export type OrganizationSlug = typeof OrganizationSlug.Type;
export type OrganizationMetadata = typeof OrganizationMetadata.Type;
export type OrganizationPlan = typeof OrganizationPlan.Type;
export type Organization = typeof Organization.Type;
export type OrganizationUpdate = typeof OrganizationUpdate.Type;
export type OrganizationInsert = typeof OrganizationInsert.Type;
