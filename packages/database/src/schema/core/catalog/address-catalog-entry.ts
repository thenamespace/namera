import type {
  AddressCatalogEntryId,
  AddressCatalogId,
  ContractInterfaceId,
} from "@namera-ai/protocol";
import type { AddressCatalogEntryEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, text, unique } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { coreSchema } from "../common.js";
import { addressCatalog } from "./address-catalog.js";
import { contractInterface } from "./contract-interface.js";

export const addressCatalogEntry = coreSchema.table(
  "address_catalog_entry",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<AddressCatalogEntryId>(),
    catalogId: text("catalog_id").notNull().$type<AddressCatalogId>(),
    namespace: text("namespace").notNull().$type<AddressCatalogEntryEncoded["namespace"]>(),
    chainId: text("chain_id").notNull().$type<AddressCatalogEntryEncoded["chainId"]>(),
    address: text("address").notNull().$type<AddressCatalogEntryEncoded["address"]>(),
    interfaceId: text("interface_id")
      .$type<ContractInterfaceId>()
      .references(() => contractInterface.id, { onDelete: "restrict" }),
    data: jsonb("data").notNull().$type<AddressCatalogEntryEncoded["data"]>(),
    status: text("status")
      .notNull()
      .default("disabled")
      .$type<AddressCatalogEntryEncoded["status"]>(),
    revision: integer("revision").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    unique("address_catalog_entry_address_unique").on(
      table.namespace,
      table.chainId,
      table.address,
    ),
    foreignKey({
      name: "address_catalog_entry_catalog_namespace_fk",
      columns: [table.catalogId, table.namespace],
      foreignColumns: [addressCatalog.id, addressCatalog.namespace],
    }).onDelete("restrict"),
    check("address_catalog_entry_namespace_check", sql`${table.namespace} = 'eip155'`),
    check(
      "address_catalog_entry_chain_check",
      sql`${table.chainId} IN (
    'eip155:1', 'eip155:10', 'eip155:5042', 'eip155:5042002', 'eip155:8453', 'eip155:42161',
    'eip155:84532', 'eip155:421614', 'eip155:11155111', 'eip155:11155420'
  )`,
    ),
    // Lowercase storage makes the address identity constraint case-insensitive.
    check("address_catalog_entry_address_check", sql`${table.address} ~ '^0x[0-9a-f]{40}$'`),
    check(
      "address_catalog_entry_status_check",
      sql`${table.status} IN ('active', 'deprecated', 'disabled')`,
    ),
    check("address_catalog_entry_revision_check", sql`${table.revision} > 0`),
    check(
      "address_catalog_entry_data_check",
      sql`(
    jsonb_typeof(${table.data}) = 'object'
    AND ${table.data}->'version' = '1'::jsonb
    AND ${table.data}->>'type' IN ('erc20', 'contract')
    AND NOT (${table.data} ?| ARRAY['abi', 'abiOverride', 'interfaceId'])
    AND CASE WHEN ${table.data}->>'type' = 'erc20' THEN
      jsonb_typeof(${table.data}->'decimals') = 'number'
      AND ${table.data}->>'decimals' ~ '^(0|[1-9][0-9]{0,2})$'
      AND (${table.data}->>'decimals')::numeric BETWEEN 0 AND 255
    ELSE NOT (${table.data} ? 'decimals') END
  ) IS TRUE`,
    ),
    index("address_catalog_entry_catalog_idx").on(table.catalogId, table.namespace),
    index("address_catalog_entry_active_catalog_chain_idx")
      .on(table.catalogId, table.chainId)
      .where(sql`${table.status} = 'active'`),
    index("address_catalog_entry_interface_idx").on(table.interfaceId),
  ],
);
