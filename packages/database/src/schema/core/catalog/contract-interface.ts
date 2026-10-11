import type { ContractInterfaceId } from "@namera-ai/protocol";
import type { ContractInterfaceEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, jsonb, text, unique } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { coreSchema } from "../common.js";

export const contractInterface = coreSchema.table(
  "contract_interface",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<ContractInterfaceId>(),
    format: text("format").notNull().$type<ContractInterfaceEncoded["format"]>(),
    document: jsonb("document").notNull().$type<ContractInterfaceEncoded["document"]>(),
    contentHash: text("content_hash").notNull(),
    sourceUrl: text("source_url").notNull(),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("contract_interface_format_hash_unique").on(table.format, table.contentHash),
    check("contract_interface_format_check", sql`${table.format} = 'evm-abi'`),
    check("contract_interface_document_check", sql`jsonb_typeof(${table.document}) = 'array'`),
    check("contract_interface_hash_check", sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
  ],
);
