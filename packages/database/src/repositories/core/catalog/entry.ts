import { Context, Effect, Layer, Schema } from "effect";

import type { AddressCatalogEntryId, AddressCatalogId } from "@namera-ai/protocol";
import { ImportCatalogEntry, type CatalogAddress } from "@namera-ai/protocol/dto";
import { AddressCatalogEntry } from "@namera-ai/protocol/model";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { addressCatalogEntry as entry } from "#/schema/index";

const decode = (row: unknown) => Schema.decodeUnknownSync(AddressCatalogEntry)(row);
const make = Effect.gen(function* () {
  const database = yield* Database;
  const getByIds = Effect.fn("database.catalogEntry.getByIds")(function* (
    ids: readonly AddressCatalogEntryId[],
  ) {
    if (!ids.length) return [];
    const db = yield* transactionOrDatabase(database);
    return (yield* db.select().from(entry).where(inArray(entry.id, ids))).map(decode);
  }, mapRepositoryError);
  const listByCatalogIds = Effect.fn("database.catalogEntry.listByCatalogIds")(function* (
    ids: readonly AddressCatalogId[],
  ) {
    if (!ids.length) return [];
    const db = yield* transactionOrDatabase(database);
    return (yield* db
      .select()
      .from(entry)
      .where(inArray(entry.catalogId, ids))
      .orderBy(asc(entry.id))).map(decode);
  }, mapRepositoryError);
  return {
    getByIds,
    listByCatalogIds,
    getById: Effect.fn("database.catalogEntry.getById")(function* (id: AddressCatalogEntryId) {
      return (yield* getByIds([id]))[0];
    }),
    listByCatalogId: Effect.fn("database.catalogEntry.listByCatalogId")(function* (
      id: AddressCatalogId,
    ) {
      return yield* listByCatalogIds([id]);
    }),
    findByAddresses: Effect.fn("database.catalogEntry.findByAddresses")(function* (
      addresses: readonly CatalogAddress[],
    ) {
      if (!addresses.length) return [];
      const db = yield* transactionOrDatabase(database);
      return (yield* db
        .select()
        .from(entry)
        .where(
          or(
            ...addresses.map((address) =>
              and(
                eq(entry.namespace, address.namespace),
                eq(entry.chainId, address.chainId),
                sql`${entry.address} = ${address.address.toLowerCase()}`,
              ),
            ),
          ),
        )).map(decode);
    }, mapRepositoryError),
    upsertMany: Effect.fn("database.catalogEntry.upsertMany")(function* (
      records: readonly ImportCatalogEntry[],
    ) {
      const db = yield* transactionOrDatabase(database);
      for (const record of records) {
        const encoded = Schema.encodeSync(ImportCatalogEntry)(record);
        yield* db
          .insert(entry)
          .values({
            ...encoded,
            id: record.id,
            catalogId: record.catalogId,
            interfaceId: record.interfaceId,
            address: record.address,
          })
          .onConflictDoUpdate({
            target: entry.id,
            set: {
              ...encoded,
              id: record.id,
              catalogId: record.catalogId,
              interfaceId: record.interfaceId,
              address: record.address,
              revision: sql`${entry.revision} + 1`,
              updatedAt: sql`now()`,
            },
          });
      }
    }, mapRepositoryError),
  };
});
export class AddressCatalogEntryRepository extends Context.Service<
  AddressCatalogEntryRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/AddressCatalogEntryRepository") {
  static readonly layer = Layer.effect(this, make);
}
