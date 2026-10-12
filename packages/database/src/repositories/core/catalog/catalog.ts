import { Context, Effect, Layer, Schema } from "effect";

import type { AddressCatalogId } from "@namera-ai/protocol";
import {
  ImportCatalogRecord,
  type SearchCatalogRequest,
  type ListAdminCatalogRequest,
} from "@namera-ai/protocol/dto";
import { AddressCatalog } from "@namera-ai/protocol/model";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { addressCatalog as catalog, addressCatalogEntry as entry } from "#/schema/index";

const decode = (row: unknown) => Schema.decodeUnknownSync(AddressCatalog)(row);
const make = Effect.gen(function* () {
  const database = yield* Database;
  const getByIds = Effect.fn("database.catalog.getByIds")(function* (
    ids: readonly AddressCatalogId[],
  ) {
    if (!ids.length) return [];
    const db = yield* transactionOrDatabase(database);
    return (yield* db.select().from(catalog).where(inArray(catalog.id, ids))).map(decode);
  }, mapRepositoryError);
  return {
    listAdmin: Effect.fn("database.catalog.listAdmin")(function* (input: ListAdminCatalogRequest) {
      const db = yield* transactionOrDatabase(database);
      const query = input.query?.trim().toLowerCase() ?? "";
      const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      const deployment = sql`exists (select 1 from ${entry} where ${entry.catalogId} = ${catalog.id}
        ${input.chainId ? sql`and ${entry.chainId} = ${input.chainId}` : sql``}
        and ${entry.address} = ${query})`;
      return (yield* db
        .select()
        .from(catalog)
        .where(
          and(
            eq(catalog.namespace, input.namespace),
            input.status ? eq(catalog.status, input.status) : undefined,
            input.types ? inArray(sql<string>`${catalog.data}->>'type'`, input.types) : undefined,
            input.chainId
              ? sql`exists (select 1 from ${entry} where ${entry.catalogId} = ${catalog.id} and ${entry.chainId} = ${input.chainId})`
              : undefined,
            query
              ? sql`(${catalog.data}->'display'->>'name' ilike ${pattern}
          or ${catalog.data}->'details'->>'symbol' ilike ${pattern}
          or ${catalog.slug} ilike ${pattern} or ${catalog.searchText} ilike ${pattern} or ${deployment})`
              : undefined,
          ),
        )
        .orderBy(asc(catalog.slug), asc(catalog.id))
        .limit((input.limit ?? 25) + 1)
        .offset(input.offset ?? 0)).map(decode);
    }, mapRepositoryError),
    getByIds,
    getById: Effect.fn("database.catalog.getById")(function* (id: AddressCatalogId) {
      return (yield* getByIds([id]))[0];
    }),
    findBySlugs: Effect.fn("database.catalog.findBySlugs")(function* (slugs: readonly string[]) {
      if (!slugs.length) return [];
      const db = yield* transactionOrDatabase(database);
      return (yield* db.select().from(catalog).where(inArray(catalog.slug, slugs))).map(decode);
    }, mapRepositoryError),
    search: Effect.fn("database.catalog.search")(function* (input: SearchCatalogRequest) {
      const db = yield* transactionOrDatabase(database);
      const query = input.query?.trim().toLowerCase() ?? "";
      const escaped = query.replace(/[\\%_]/g, "\\$&");
      const prefix = `${escaped}%`;
      const substring = `%${escaped}%`;
      const name = sql`lower(${catalog.data}->'display'->>'name')`;
      const symbol = sql`lower(${catalog.data}->'details'->>'symbol')`;
      const exactTerm = sql`exists (select 1 from unnest(${catalog.search}) as term where lower(term) = ${query})`;
      const prefixTerm = sql`exists (select 1 from unnest(${catalog.search}) as term where term ilike ${prefix})`;
      const exactAddress = /^0x[0-9a-f]{40}$/.test(query);
      const deployment = sql`exists (select 1 from ${entry} where ${entry.catalogId} = ${catalog.id}
        and ${entry.status} = 'active'
        ${input.chainId ? sql`and ${entry.chainId} = ${input.chainId}` : sql``}
        ${exactAddress ? sql`and ${entry.address} = ${query}` : sql``})`;
      const matches =
        query && !exactAddress
          ? sql`(
        ${name} like ${prefix} or ${symbol} like ${prefix} or ${prefixTerm}
        ${query.length >= 3 ? sql`or ${catalog.searchText} ilike ${substring}` : sql``}
        ${query.length >= 3 ? sql`or ${catalog.searchText} %> ${query}` : sql``}
      )`
          : undefined;
      const rank =
        query && !exactAddress
          ? sql`case when ${symbol} = ${query} then 0 when ${name} = ${query} then 1
        when ${exactTerm} then 2
        when ${name} like ${prefix} or ${symbol} like ${prefix} or ${prefixTerm} then 3
        when ${catalog.searchText} ilike ${substring} then 4 else 5 end`
          : sql`0 + 0`;
      const similarity =
        query.length >= 3 && !exactAddress
          ? sql`word_similarity(${query}, ${catalog.searchText})`
          : sql`0 + 0`;
      return (yield* db
        .select()
        .from(catalog)
        .where(
          and(
            eq(catalog.namespace, input.namespace),
            eq(catalog.status, "published"),
            deployment,
            matches,
            input.types ? inArray(sql<string>`${catalog.data}->>'type'`, input.types) : undefined,
          ),
        )
        .orderBy(rank, desc(similarity), asc(name), asc(catalog.id))
        .limit((input.limit ?? 20) + 1)
        .offset(input.offset ?? 0)).map(decode);
    }, mapRepositoryError),
    // The import workflow holds the platform transaction lock and passes only changed records.
    upsertMany: Effect.fn("database.catalog.upsertMany")(function* (
      records: readonly ImportCatalogRecord[],
    ) {
      const db = yield* transactionOrDatabase(database);
      for (const record of records) {
        const encoded = Schema.encodeSync(ImportCatalogRecord)(record);
        yield* db
          .insert(catalog)
          .values({
            ...encoded,
            id: record.id,
            search: [...encoded.search],
            searchText: record.search.join(" "),
          })
          .onConflictDoUpdate({
            target: catalog.id,
            set: {
              ...encoded,
              id: record.id,
              search: [...encoded.search],
              searchText: record.search.join(" "),
              revision: sql`${catalog.revision} + 1`,
              updatedAt: sql`now()`,
            },
          });
      }
    }, mapRepositoryError),
  };
});
export class AddressCatalogRepository extends Context.Service<
  AddressCatalogRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/AddressCatalogRepository") {
  static readonly layer = Layer.effect(this, make);
}
