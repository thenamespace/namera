import type { AddressMetadata, AddressMetadataEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, jsonb, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { timestamps } from "#/schema/common";

import { coreSchema } from "./common.js";

export const addressMetadata = coreSchema.table(
  "address_metadata",
  {
    namespace: text("namespace").notNull().$type<AddressMetadata["namespace"]>(),
    chainId: text("chain_id").notNull().$type<AddressMetadata["chainId"]>(),
    address: text("address").notNull().$type<AddressMetadata["address"]>(),
    data: jsonb("data").notNull().$type<AddressMetadataEncoded["data"]>(),
    observedAt: timestamp("observed_at", { mode: "date", withTimezone: true }).notNull(),
    refreshAfter: timestamp("refresh_after", { mode: "date", withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      name: "address_metadata_pk",
      columns: [table.namespace, table.chainId, table.address],
    }),
    check("address_metadata_data_object_check", sql`jsonb_typeof(${table.data}) = 'object'`),
    index("address_metadata_refresh_after_idx").on(table.refreshAfter),
    index("address_metadata_display_name_trgm_idx").using(
      "gin",
      sql`lower(${table.data} #>> '{identity,displayName}') gin_trgm_ops`,
    ),
    index("address_metadata_token_symbol_trgm_idx").using(
      "gin",
      sql`lower(${table.data} #>> '{token,symbol}') gin_trgm_ops`,
    ),
  ],
);
