import type { AddressCatalogId } from "@namera-ai/protocol";
import type { AddressCatalogEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, text, unique } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { coreSchema } from "../common.js";

export const addressCatalog = coreSchema.table(
  "address_catalog",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<AddressCatalogId>(),
    namespace: text("namespace").notNull().$type<AddressCatalogEncoded["namespace"]>(),
    slug: text("slug").notNull(),
    search: text("search").array().notNull(),
    searchText: text("search_text").notNull(),
    data: jsonb("data").notNull().$type<AddressCatalogEncoded["data"]>(),
    status: text("status").notNull().default("draft").$type<AddressCatalogEncoded["status"]>(),
    revision: integer("revision").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    unique("address_catalog_namespace_slug_unique").on(table.namespace, table.slug),
    unique("address_catalog_id_namespace_unique").on(table.id, table.namespace),
    check("address_catalog_namespace_check", sql`${table.namespace} = 'eip155'`),
    check(
      "address_catalog_status_check",
      sql`${table.status} IN ('draft', 'published', 'archived')`,
    ),
    check("address_catalog_revision_check", sql`${table.revision} > 0`),
    check("address_catalog_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check(
      "address_catalog_data_check",
      sql`(
    jsonb_typeof(${table.data}) = 'object'
    AND ${table.data}->'version' = '1'::jsonb
    AND ${table.data}->>'type' IN ('erc20', 'contract')
    AND jsonb_typeof(${table.data}->'display') = 'object'
    AND jsonb_typeof(${table.data}->'details') = 'object'
    AND (${table.data}->>'type' <> 'erc20' OR jsonb_typeof(${table.data}->'details'->'symbol') = 'string')
    AND NOT (${table.data} ?| ARRAY['abi', 'abiOverride', 'interfaceId'])
  ) IS TRUE`,
    ),
    index("address_catalog_search_trgm_idx")
      .using("gin", table.searchText.op("gin_trgm_ops"))
      .where(sql`${table.status} = 'published'`),
  ],
);
