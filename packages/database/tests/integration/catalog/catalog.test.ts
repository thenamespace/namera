import { expect, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { AddressCatalog, AddressCatalogEntry, ContractInterface } from "@namera-ai/protocol/model";
import { eq, sql } from "drizzle-orm";

import { Database, TestDatabase } from "../../../src/index.js";
import {
  addressCatalog,
  addressCatalogEntry,
  contractInterface,
} from "../../../src/schema/index.js";

const fixture = Effect.fnUntraced(function* () {
  yield* (yield* TestDatabase).reset;
  const db = yield* Database;
  const [catalog] = yield* db
    .insert(addressCatalog)
    .values({
      namespace: "eip155",
      slug: "example",
      search: ["example", "ex"],
      searchText: "example ex",
      data: {
        version: 1,
        type: "erc20",
        display: { name: "Example", logo: "address-catalog/example.svg", aliases: [], tags: [] },
        details: { symbol: "EX" },
      },
    })
    .returning();
  const [artifact] = yield* db
    .insert(contractInterface)
    .values({
      format: "evm-abi",
      document: [],
      contentHash: "a".repeat(64),
      sourceUrl: "https://example.test/abi.json",
    })
    .returning();
  if (!catalog || !artifact) throw new Error("Missing catalog fixture");
  const input = {
    catalogId: catalog.id,
    namespace: "eip155",
    chainId: "eip155:1",
    address: "0x1111111111111111111111111111111111111111",
    interfaceId: artifact.id,
    data: { version: 1, type: "erc20", decimals: 6 },
  } as const;
  return { db, catalog, artifact, input };
});

layer(TestDatabase.layer)("catalog schema persistence", (it) => {
  it.effect("persists contract metadata and its JSON ABI independently", () =>
    Effect.gen(function* () {
      const { db, catalog, artifact, input } = yield* fixture();
      const document = [
        {
          type: "function",
          name: "execute",
          inputs: [],
          outputs: [],
          stateMutability: "payable",
        },
      ] as const;
      const [contract] = yield* db
        .insert(addressCatalog)
        .values({
          namespace: "eip155",
          slug: "example-router",
          search: ["example router"],
          searchText: "example router",
          data: {
            version: 1,
            type: "contract",
            display: catalog.data.display,
            details: { protocol: "Example", contractVersion: "1" },
          },
        })
        .returning();
      if (!contract) throw new Error("Missing contract fixture");
      const [abi] = yield* db
        .insert(contractInterface)
        .values({
          format: "evm-abi",
          document,
          contentHash: "b".repeat(64),
          sourceUrl: artifact.sourceUrl,
        })
        .returning();
      if (!abi) throw new Error("Missing interface fixture");
      const [deployment] = yield* db
        .insert(addressCatalogEntry)
        .values({
          ...input,
          catalogId: contract.id,
          interfaceId: abi.id,
          data: { version: 1, type: "contract" },
        })
        .returning();
      expect(Schema.decodeUnknownSync(AddressCatalogEntry)(deployment).data.type).toBe("contract");
      expect(Schema.decodeUnknownSync(ContractInterface)(abi).document).toEqual(document);
    }),
  );

  it.effect("shares interfaces across chains and allows multiple deployments per chain", () =>
    Effect.gen(function* () {
      const { db, catalog, artifact, input } = yield* fixture();
      const entries = yield* db
        .insert(addressCatalogEntry)
        .values([
          input,
          { ...input, chainId: "eip155:8453" },
          { ...input, address: "0x2222222222222222222222222222222222222222", interfaceId: null },
        ])
        .returning();
      for (const entry of entries)
        expect(Schema.decodeUnknownSync(AddressCatalogEntry)(entry).catalogId).toBe(catalog.id);
      const { searchText: _searchText, ...model } = catalog;
      expect(Schema.decodeUnknownSync(AddressCatalog)(model).status).toBe("draft");
      expect(Schema.decodeUnknownSync(ContractInterface)(artifact).format).toBe("evm-abi");
      const related = yield* db.query.addressCatalog.findFirst({
        where: { id: { eq: catalog.id } },
        with: { entries: { with: { interface: true } } },
      });
      expect(related?.entries).toHaveLength(3);
      expect(related?.entries.filter((entry) => entry.interface?.id === artifact.id)).toHaveLength(
        2,
      );
      yield* (yield* TestDatabase).reset;
      expect(yield* db.select().from(contractInterface)).toEqual([]);
    }),
  );

  it.effect("enforces identities, references and restricted deletion", () =>
    Effect.gen(function* () {
      const { db, catalog, artifact, input } = yield* fixture();
      yield* db.insert(addressCatalogEntry).values(input);
      expect(yield* db.insert(addressCatalogEntry).values(input).pipe(Effect.isFailure)).toBe(true);
      expect(
        yield* db
          .insert(addressCatalog)
          .values({ ...catalog, id: sql`'other'` })
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(
        yield* db
          .insert(contractInterface)
          .values({ ...artifact, id: sql`'other'` })
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(
        yield* db
          .insert(addressCatalogEntry)
          .values({
            ...input,
            address: "0x3333333333333333333333333333333333333333",
            catalogId: sql`'missing'`,
          })
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(
        yield* db
          .insert(addressCatalogEntry)
          .values({
            ...input,
            address: "0x3333333333333333333333333333333333333333",
            interfaceId: sql`'missing'`,
          })
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(
        yield* db
          .delete(addressCatalog)
          .where(eq(addressCatalog.id, catalog.id))
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(
        yield* db
          .delete(contractInterface)
          .where(eq(contractInterface.id, artifact.id))
          .pipe(Effect.isFailure),
      ).toBe(true);
    }),
  );

  it.effect(
    "rejects unsupported namespaces, chains, states, address casing and malformed JSON",
    () =>
      Effect.gen(function* () {
        const { db, catalog, artifact, input } = yield* fixture();
        const [entry] = yield* db.insert(addressCatalogEntry).values(input).returning();
        if (!entry) throw new Error("Missing entry fixture");
        for (const update of [
          { namespace: sql`'solana'` },
          { chainId: sql`'eip155:137'` },
          { status: sql`'unknown'` },
          { revision: 0 },
          { address: sql`'0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'` },
          ...[
            {},
            [],
            null,
            { version: 2, type: "contract" },
            { version: 1, type: "erc721" },
            { version: 1, type: "erc20" },
            { version: 1, type: "erc20", decimals: -1 },
            { version: 1, type: "erc20", decimals: 256 },
            { version: 1, type: "erc20", decimals: 1.5 },
            { version: 1, type: "erc20", decimals: "6" },
            { version: 1, type: "contract", decimals: 6 },
            { version: 1, type: "contract", abi: [] },
          ].map((data) => ({ data: sql`${JSON.stringify(data)}::jsonb` })),
        ])
          expect(
            yield* db
              .update(addressCatalogEntry)
              .set(update)
              .where(eq(addressCatalogEntry.id, entry.id))
              .pipe(Effect.isFailure),
          ).toBe(true);
        for (const data of [
          {},
          [],
          null,
          { ...catalog.data, version: "1" },
          { ...catalog.data, type: "erc721" },
          { ...catalog.data, details: {} },
          { ...catalog.data, abi: [] },
        ]) {
          expect(
            yield* db
              .update(addressCatalog)
              .set({ data: sql`${JSON.stringify(data)}::jsonb` })
              .where(eq(addressCatalog.id, catalog.id))
              .pipe(Effect.isFailure),
          ).toBe(true);
        }
        for (const update of [
          { format: sql`'anchor-idl'` },
          { document: sql`'{}'::jsonb` },
          { contentHash: "invalid" },
        ]) {
          expect(
            yield* db
              .update(contractInterface)
              .set(update)
              .where(eq(contractInterface.id, artifact.id))
              .pipe(Effect.isFailure),
          ).toBe(true);
        }
      }),
  );
});
