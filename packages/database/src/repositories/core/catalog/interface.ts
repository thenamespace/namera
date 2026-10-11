import { Context, Effect, Layer, Schema } from "effect";

import type { ContractInterfaceId } from "@namera-ai/protocol";
import { ContractInterfaceSummary, type ListAdminInterfacesRequest } from "@namera-ai/protocol/dto";
import { ContractInterface, ContractInterfaceInsert } from "@namera-ai/protocol/model";
import { and, desc, eq, inArray, ilike, or } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { contractInterface, addressCatalog, addressCatalogEntry } from "#/schema/index";

const decode = (row: unknown) => Schema.decodeUnknownSync(ContractInterface)(row);
const make = Effect.gen(function* () {
  const database = yield* Database;
  const getByIds = Effect.fn("database.contractInterface.getByIds")(function* (
    ids: readonly ContractInterfaceId[],
  ) {
    if (!ids.length) return [];
    const db = yield* transactionOrDatabase(database);
    return (yield* db
      .select()
      .from(contractInterface)
      .where(inArray(contractInterface.id, ids))).map(decode);
  }, mapRepositoryError);
  return {
    listAdmin: Effect.fn("database.contractInterface.listAdmin")(function* (
      input: ListAdminInterfacesRequest,
    ) {
      const db = yield* transactionOrDatabase(database);
      const query = input.query?.trim();
      const pattern = `%${query?.replace(/[\\%_]/g, "\\$&") ?? ""}%`;
      const rows = yield* db
        .select({
          id: contractInterface.id,
          format: contractInterface.format,
          contentHash: contractInterface.contentHash,
          sourceUrl: contractInterface.sourceUrl,
          createdAt: contractInterface.createdAt,
        })
        .from(contractInterface)
        .where(
          query
            ? or(
                ilike(contractInterface.id, pattern),
                ilike(contractInterface.contentHash, pattern),
                ilike(contractInterface.sourceUrl, pattern),
              )
            : undefined,
        )
        .orderBy(desc(contractInterface.createdAt), desc(contractInterface.id))
        .limit((input.limit ?? 25) + 1)
        .offset(input.offset ?? 0);
      return rows.map((row) => Schema.decodeUnknownSync(ContractInterfaceSummary)(row));
    }, mapRepositoryError),
    getByIds,
    getById: Effect.fn("database.contractInterface.getById")(function* (id: ContractInterfaceId) {
      return (yield* getByIds([id]))[0];
    }),
    isPublished: Effect.fn("database.contractInterface.isPublished")(function* (
      id: ContractInterfaceId,
    ) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .select({ id: addressCatalogEntry.id })
        .from(addressCatalogEntry)
        .innerJoin(addressCatalog, eq(addressCatalog.id, addressCatalogEntry.catalogId))
        .where(
          and(
            eq(addressCatalogEntry.interfaceId, id),
            eq(addressCatalogEntry.status, "active"),
            eq(addressCatalog.status, "published"),
          ),
        )
        .limit(1);
      return rows.length > 0;
    }, mapRepositoryError),
    findByHashes: Effect.fn("database.contractInterface.findByHashes")(function* (
      hashes: readonly string[],
    ) {
      if (!hashes.length) return [];
      const db = yield* transactionOrDatabase(database);
      return (yield* db
        .select()
        .from(contractInterface)
        .where(inArray(contractInterface.contentHash, hashes))).map(decode);
    }, mapRepositoryError),
    insertMany: Effect.fn("database.contractInterface.insertMany")(function* (
      records: readonly ContractInterfaceInsert[],
    ) {
      const db = yield* transactionOrDatabase(database);
      for (const record of records) {
        const encoded = Schema.encodeSync(ContractInterfaceInsert)(record);
        yield* db.insert(contractInterface).values({ ...encoded, id: record.id });
      }
    }, mapRepositoryError),
  };
});
export class ContractInterfaceRepository extends Context.Service<
  ContractInterfaceRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/ContractInterfaceRepository") {
  static readonly layer = Layer.effect(this, make);
}
