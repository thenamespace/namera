// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, EthereumAddress, SupportedEvmChainId } from "@namera-ai/protocol";
import {
  AddressMetadata,
  AddressMetadataInsert,
  type AddressMetadata as AddressMetadataModel,
  type AddressMetadataInsert as AddressMetadataInsertModel,
} from "@namera-ai/protocol/model";
import { and, eq, ilike, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { addressMetadata } from "#/schema/index";

export interface AddressMetadataKey {
  readonly namespace: "eip155";
  readonly chainId: SupportedEvmChainId;
  readonly address: EthereumAddress;
}

export interface AddressMetadataRepositoryService {
  readonly find: (
    key: AddressMetadataKey,
  ) => Effect.Effect<AddressMetadataModel | undefined, DatabaseError>;
  readonly findMany: (
    keys: ReadonlyArray<AddressMetadataKey>,
  ) => Effect.Effect<ReadonlyArray<AddressMetadataModel>, DatabaseError>;
  readonly search: (input: {
    readonly namespace: "eip155";
    readonly chainId: SupportedEvmChainId;
    readonly query: string;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<AddressMetadataModel>, DatabaseError>;
  readonly upsertMany: (
    rows: ReadonlyArray<AddressMetadataInsertModel>,
  ) => Effect.Effect<ReadonlyArray<AddressMetadataModel>, DatabaseError>;
  readonly findStaleBefore: (
    before: DateTime.Utc,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<AddressMetadataModel>, DatabaseError>;
}

const decodeRow = (row: unknown): AddressMetadataModel => {
  const decoded = Schema.decodeUnknownSync(AddressMetadata)(row);
  if (
    decoded.data.namespace !== decoded.namespace ||
    decoded.data.chainId !== decoded.chainId ||
    decoded.data.address.toLowerCase() !== decoded.address.toLowerCase()
  ) {
    throw new Error("Address metadata JSON identity does not match its row key");
  }
  return decoded;
};

export class AddressMetadataRepository extends Context.Service<
  AddressMetadataRepository,
  AddressMetadataRepositoryService
>()("@namera-ai/database/AddressMetadataRepository") {
  static readonly layer: Layer.Layer<AddressMetadataRepository, never, Database> = Layer.effect(
    AddressMetadataRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return AddressMetadataRepository.of({
        find: Effect.fn("database.addressMetadataRepository.find")(function* (key) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.addressMetadata.findFirst({
            where: {
              namespace: { eq: key.namespace },
              chainId: { eq: key.chainId },
              address: { eq: key.address },
            },
          });
          return row === undefined ? undefined : decodeRow(row);
        }, mapRepositoryError),
        findMany: Effect.fn("database.addressMetadataRepository.findMany")(function* (keys) {
          if (keys.length === 0) return [];
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(addressMetadata)
            .where(
              or(
                ...keys.map((key) =>
                  and(
                    eq(addressMetadata.namespace, key.namespace),
                    eq(addressMetadata.chainId, key.chainId),
                    eq(addressMetadata.address, key.address),
                  ),
                ),
              ),
            );
          return rows.map(decodeRow);
        }, mapRepositoryError),
        search: Effect.fn("database.addressMetadataRepository.search")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const pattern = `%${input.query.toLowerCase()}%`;
          const rows = yield* db
            .select()
            .from(addressMetadata)
            .where(
              and(
                eq(addressMetadata.namespace, input.namespace),
                eq(addressMetadata.chainId, input.chainId),
                or(
                  ilike(addressMetadata.address, pattern),
                  ilike(
                    sql<string>`lower(${addressMetadata.data} #>> '{identity,displayName}')`,
                    pattern,
                  ),
                  ilike(sql<string>`lower(${addressMetadata.data} #>> '{token,symbol}')`, pattern),
                ),
              ),
            )
            .limit(input.limit);
          return rows.map(decodeRow);
        }, mapRepositoryError),
        upsertMany: Effect.fn("database.addressMetadataRepository.upsertMany")(function* (rows) {
          if (rows.length === 0) return [];
          const db = yield* transactionOrDatabase(database);
          const encoded = rows.map((row) => Schema.encodeSync(AddressMetadataInsert)(row) as any);
          const persisted = yield* db
            .insert(addressMetadata)
            .values(encoded)
            .onConflictDoUpdate({
              target: [addressMetadata.namespace, addressMetadata.chainId, addressMetadata.address],
              set: {
                data: sql`excluded.data`,
                observedAt: sql`excluded.observed_at`,
                refreshAfter: sql`excluded.refresh_after`,
                updatedAt: sql`now()`,
              },
            })
            .returning();
          return persisted.map(decodeRow);
        }, mapRepositoryError),
        findStaleBefore: Effect.fn("database.addressMetadataRepository.findStaleBefore")(function* (
          before,
          limit,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db.query.addressMetadata.findMany({
            where: { refreshAfter: { lte: Schema.encodeSync(Schema.DateTimeUtcFromDate)(before) } },
            orderBy: { refreshAfter: "asc" },
            limit,
          });
          return rows.map(decodeRow);
        }, mapRepositoryError),
      });
    }),
  );
}
