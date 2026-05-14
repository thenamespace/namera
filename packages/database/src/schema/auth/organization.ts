import { json, text, uniqueIndex } from "drizzle-orm/pg-core";

import { timestamps } from "../common";
import { authSchema } from "./common";

export const organization = authSchema.table.withRLS(
  "organization",
  {
    id: text("id").primaryKey(),
    metadata: json("metadata"),
    plan: text("plan").notNull(),
    slug: text("slug").notNull().unique(),
    ...timestamps,
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)],
);
