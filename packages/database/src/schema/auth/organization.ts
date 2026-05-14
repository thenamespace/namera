import type {
  OrganizationId,
  OrganizationMetadata,
  OrganizationSlug,
} from "@namera-ai/schema";

import { json, text, uniqueIndex } from "drizzle-orm/pg-core";

import { OrganizationPlan } from "@namera-ai/schema";

import { generateUniqueId, timestamps } from "../common";
import { authSchema } from "./common";

export const organization = authSchema.table.withRLS(
  "organization",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationId>(),
    metadata: json("metadata").$type<OrganizationMetadata>(),
    plan: text("plan").notNull().$type<OrganizationPlan>(),
    slug: text("slug").notNull().unique().$type<OrganizationSlug>(),
    ...timestamps,
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)],
);
