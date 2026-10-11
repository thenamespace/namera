import { describe, expect, layer } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { AddressCatalogId, AddressCatalogEntryId, ContractInterfaceId } from "@namera-ai/protocol";
import { ImportCatalogRequest } from "@namera-ai/protocol/dto";
import { EthereumAddress } from "@namera-ai/protocol/evm";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const catalogId = AddressCatalogId.make("01950000-0000-7000-8000-000000000001");
const entryId = AddressCatalogEntryId.make("01950000-0000-7000-8000-000000000002");
const interfaceId = ContractInterfaceId.make("01950000-0000-7000-8000-000000000003");
const address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const payload = Schema.decodeUnknownSync(ImportCatalogRequest)({
  version: 1,
  interfaces: [
    {
      id: interfaceId,
      format: "evm-abi",
      document: [],
      sourceUrl: "https://example.test/abi.json",
    },
  ],
  catalog: [
    {
      id: catalogId,
      namespace: "eip155",
      slug: "example-dollar",
      search: ["Example Dollar", "EXUSD", "stablecoin", "dollar"],
      status: "published",
      data: {
        version: 1,
        type: "erc20",
        display: { name: "Example Dollar", aliases: ["Dollar"], tags: ["stablecoin"] },
        details: { symbol: "EXUSD" },
      },
    },
  ],
  entries: [
    {
      id: entryId,
      catalogId,
      namespace: "eip155",
      chainId: "eip155:8453",
      address,
      interfaceId,
      status: "active",
      data: { version: 1, type: "erc20", decimals: 6 },
    },
  ],
});

describe.skipIf(process.env.NAMERA_TEST_POSTGRES_PORT === undefined)(
  "PostgreSQL catalog imports",
  () => {
    layer(TestServerLayer)((it) => {
      it.effect("serializes concurrent retries and emits one audit event", () =>
        Effect.gen(function* () {
          const { owner, repository, db } = yield* setup;
          const results = yield* Effect.all(
            Array.from({ length: 8 }, () =>
              owner.client.adminCatalog.import({ payload, query: {} }),
            ),
            { concurrency: 8 },
          );
          expect(results.reduce((count, result) => count + result.catalog.created, 0)).toBe(1);
          expect(results.reduce((count, result) => count + result.catalog.unchanged, 0)).toBe(7);
          expect((yield* repository.core.catalog.getById(catalogId))?.revision).toBe(1);
          expect(
            (yield* db.query.platformEvent.findMany()).filter(
              (event) => event.data.type === "catalog.imported",
            ),
          ).toHaveLength(1);
        }),
      );
    });
  },
);
const setup = Effect.gen(function* () {
  yield* resetTestState();
  const owner = yield* platformIdentity();
  const client = yield* makeTestApiClient;
  yield* signIn(client, testEmail(`catalog-reader-${owner.user.id}@example.com`));
  return { owner, client, repository: yield* Repository, db: yield* Database };
});

layer(TestServerLayer)("catalog API", (it) => {
  it.effect("ranks exact symbols, curated terms, prefixes and typos with stable pagination", () =>
    Effect.gen(function* () {
      const { owner, client } = yield* setup;
      const secondId = AddressCatalogId.make("01950000-0000-7000-8000-000000000004");
      const secondEntryId = AddressCatalogEntryId.make("01950000-0000-7000-8000-000000000005");
      const batch = Schema.decodeUnknownSync(ImportCatalogRequest)({
        ...Schema.encodeSync(ImportCatalogRequest)(payload),
        catalog: [
          ...Schema.encodeSync(ImportCatalogRequest)(payload).catalog,
          {
            id: secondId,
            namespace: "eip155",
            slug: "example-router",
            status: "published",
            search: ["Example Router", "EXUSD swaps", "marketplace"],
            data: {
              version: 1,
              type: "contract",
              display: { name: "Example Router", aliases: [], tags: [] },
              details: { protocol: "Example" },
            },
          },
        ],
        entries: [
          ...Schema.encodeSync(ImportCatalogRequest)(payload).entries,
          {
            id: secondEntryId,
            catalogId: secondId,
            namespace: "eip155",
            chainId: "eip155:8453",
            address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            interfaceId,
            status: "active",
            data: { version: 1, type: "contract" },
          },
        ],
      });
      yield* owner.client.adminCatalog.import({ payload: batch, query: {} });
      const first = yield* client.catalog.search({
        query: { namespace: "eip155", query: "EXUSD", limit: 1 },
      });
      expect(first.entries.map((record) => record.id)).toEqual([catalogId]);
      expect(first.nextOffset).toBe(1);
      const second = yield* client.catalog.search({
        query: { namespace: "eip155", query: "EXUSD", limit: 1, offset: first.nextOffset ?? 0 },
      });
      expect(second.entries.map((record) => record.id)).toEqual([secondId]);
      expect(second.nextOffset).toBeNull();
      expect(
        (yield* client.catalog.search({ query: { namespace: "eip155", query: "ma" } })).entries.map(
          (record) => record.id,
        ),
      ).toEqual([secondId]);
      expect(
        (yield* client.catalog.search({
          query: { namespace: "eip155", query: "stablecon" },
        })).entries.map((record) => record.id),
      ).toContain(catalogId);
      expect(
        (yield* client.catalog.search({
          query: { namespace: "eip155", types: ["contract"], limit: 1 },
        })).entries.map((record) => record.id),
      ).toEqual([secondId]);
      expect(JSON.stringify(first)).not.toContain('"document"');
    }),
  );

  it.effect("rejects malformed raw uploads without dropping unknown fields", () =>
    Effect.gen(function* () {
      const { owner, repository } = yield* setup;
      const handler = yield* HttpRouter.toHttpEffect(HttpApiBuilder.layer(NameraApi));
      const encoded = Schema.encodeSync(ImportCatalogRequest)(payload);
      for (const malformed of [
        { ...encoded, unexpected: true },
        { ...encoded, catalog: encoded.catalog.map((record) => ({ ...record, revision: 5 })) },
        {
          ...encoded,
          catalog: encoded.catalog.map((record) => ({
            ...record,
            data: { ...record.data, abi: [] },
          })),
        },
        {
          ...encoded,
          entries: encoded.entries.map((entry) => ({
            ...entry,
            data: { ...entry.data, decimals: 256 },
          })),
        },
        {
          ...encoded,
          interfaces: encoded.interfaces.map((record) => ({
            id: record.id,
            format: record.format,
            sourceUrl: record.sourceUrl,
            document: [{ type: "receive", stateMutability: "view" }],
          })),
        },
      ]) {
        let response: HttpServerResponse.HttpServerResponse | undefined;
        yield* HttpEffect.toHandled(handler, (_request, result) =>
          Effect.sync(() => {
            response = result;
          }),
        ).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(
              new Request("http://api.test/internal/catalog/import", {
                method: "POST",
                headers: { ...owner.headers, "content-type": "application/json" },
                body: JSON.stringify(malformed),
              }),
            ),
          ),
          Effect.exit,
        );
        expect(response?.status).toBe(400);
      }
      expect(yield* repository.core.catalog.getById(catalogId)).toBeUndefined();
    }),
  );

  it.effect("rolls back catalog writes if the audit insert fails", () =>
    Effect.gen(function* () {
      const { owner, repository, db } = yield* setup;
      yield* db.execute(
        "CREATE FUNCTION public.reject_catalog_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.data->>'type' = 'catalog.imported' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$",
      );
      yield* db.execute(
        "CREATE TRIGGER reject_catalog_audit BEFORE INSERT ON audit.platform_events FOR EACH ROW EXECUTE FUNCTION public.reject_catalog_audit()",
      );
      yield* Effect.gen(function* () {
        expect(
          Exit.isFailure(
            yield* owner.client.adminCatalog.import({ payload, query: {} }).pipe(Effect.exit),
          ),
        ).toBe(true);
        expect(yield* repository.core.catalog.getById(catalogId)).toBeUndefined();
        expect(yield* repository.core.catalogEntry.getById(entryId)).toBeUndefined();
        expect(yield* repository.core.contractInterface.getById(interfaceId)).toBeUndefined();
      }).pipe(
        Effect.ensuring(
          Effect.gen(function* () {
            yield* db.execute("DROP TRIGGER reject_catalog_audit ON audit.platform_events");
            yield* db.execute("DROP FUNCTION public.reject_catalog_audit()");
          }).pipe(Effect.orDie),
        ),
      );
    }),
  );
  it.effect("previews, imports, reads and repeats without changing revisions or audit", () =>
    Effect.gen(function* () {
      const { owner, client, repository, db } = yield* setup;
      const preview = yield* owner.client.adminCatalog.import({ payload, query: { dryRun: true } });
      expect(preview).toMatchObject({
        dryRun: true,
        catalog: { created: 1 },
        entries: { created: 1 },
        interfaces: { created: 1 },
      });
      expect(yield* repository.core.catalog.getById(catalogId)).toBeUndefined();
      yield* owner.client.adminCatalog.import({ payload, query: {} });
      const before = yield* client.catalog.get({ params: { catalogId } });
      expect(before.entries[0]?.data).toEqual({ version: 1, type: "erc20", decimals: 6 });
      expect(before.search).toEqual(payload.catalog[0]?.search);
      const repeated = yield* owner.client.adminCatalog.import({ payload, query: {} });
      expect(repeated).toMatchObject({
        catalog: { created: 0, updated: 0, unchanged: 1 },
        entries: { unchanged: 1 },
        interfaces: { unchanged: 1 },
      });
      expect(yield* client.catalog.get({ params: { catalogId } })).toEqual(before);
      expect(
        (yield* db.query.platformEvent.findMany()).filter(
          (event) => event.data.type === "catalog.imported",
        ),
      ).toHaveLength(1);
      const result = yield* client.catalog.search({
        query: {
          namespace: "eip155",
          query: "exu",
          types: ["erc20", "contract"],
          chainId: "eip155:8453",
        },
      });
      expect(result.entries.map((record) => record.id)).toEqual([catalogId]);
      expect(yield* client.catalog.getEntry({ params: { entryId } })).toMatchObject({
        catalog: { id: catalogId },
        entry: { id: entryId },
      });
      const abi = yield* client.catalog.getInterface({ params: { interfaceId } });
      expect(abi.contentHash).toBe(
        "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
      );
      expect(abi.document).toEqual([]);
      const resolved = yield* client.catalog.resolve({
        payload: {
          addresses: [
            { namespace: "eip155", chainId: "eip155:8453", address: EthereumAddress.make(address) },
            { namespace: "eip155", chainId: "eip155:1", address: EthereumAddress.make(address) },
          ],
        },
      });
      expect(resolved[0]?.match?.entry.id).toBe(entryId);
      expect(resolved[1]?.match).toBeNull();
    }),
  );

  it.effect(
    "filters before pagination and hides drafts, disabled deployments and their interfaces",
    () =>
      Effect.gen(function* () {
        const { owner, client } = yield* setup;
        yield* owner.client.adminCatalog.import({ payload, query: {} });
        for (const query of [
          { types: ["contract"] as const },
          { chainId: "eip155:1" as const },
          { query: "%_\\" },
        ]) {
          expect(
            (yield* client.catalog.search({ query: { namespace: "eip155", ...query } })).entries,
          ).toHaveLength(0);
        }
        expect(
          (yield* client.catalog.search({
            query: { namespace: "eip155", query: address.toUpperCase().replace("0X", "0x") },
          })).entries,
        ).toHaveLength(1);
        const changed = {
          ...payload,
          catalog: payload.catalog.map((record) => ({ ...record, status: "draft" as const })),
        };
        yield* owner.client.adminCatalog.import({ payload: changed, query: {} });
        expect(
          (yield* client.catalog.search({ query: { namespace: "eip155" } })).entries,
        ).toHaveLength(0);
        expect(
          yield* client.catalog.get({ params: { catalogId } }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "CatalogNotFoundError" });
        expect(
          yield* client.catalog.getEntry({ params: { entryId } }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "CatalogNotFoundError" });
        expect(
          yield* client.catalog.getInterface({ params: { interfaceId } }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "CatalogNotFoundError" });
      }),
  );

  it.effect("rejects conflicting batches atomically and reports the offending field", () =>
    Effect.gen(function* () {
      const { owner, repository } = yield* setup;
      const missing = ContractInterfaceId.make("01950000-0000-7000-8000-000000000099");
      const bad = {
        ...payload,
        entries: payload.entries.map((entry) => ({ ...entry, interfaceId: missing })),
      };
      for (const dryRun of [true, false]) {
        expect(
          yield* owner.client.adminCatalog
            .import({ payload: bad, query: { dryRun } })
            .pipe(Effect.flip),
        ).toMatchObject({
          _tag: "CatalogImportError",
          collection: "entries",
          field: "interfaceId",
        });
      }
      expect(yield* repository.core.catalog.getById(catalogId)).toBeUndefined();
      expect(yield* repository.core.contractInterface.getById(interfaceId)).toBeUndefined();
      yield* owner.client.adminCatalog.import({ payload, query: {} });
      const duplicate = { ...payload, catalog: [...payload.catalog, ...payload.catalog] };
      expect(
        yield* owner.client.adminCatalog
          .import({ payload: duplicate, query: {} })
          .pipe(Effect.flip),
      ).toMatchObject({ field: "id" });
      const abiChange = {
        ...payload,
        interfaces: payload.interfaces.map((record) => ({
          ...record,
          document: [{ type: "receive" as const, stateMutability: "payable" as const }],
        })),
      };
      expect(
        yield* owner.client.adminCatalog
          .import({ payload: abiChange, query: {} })
          .pipe(Effect.flip),
      ).toMatchObject({ field: "document" });
      expect((yield* repository.core.contractInterface.getById(interfaceId))?.document).toEqual([]);
      const duplicatedAbi = {
        ...payload,
        interfaces: payload.interfaces.map((record) => ({ ...record, id: missing })),
      };
      expect(
        yield* owner.client.adminCatalog
          .import({ payload: duplicatedAbi, query: {} })
          .pipe(Effect.flip),
      ).toMatchObject({ collection: "interfaces", field: "document" });
      const wrongParentType = {
        ...payload,
        entries: payload.entries.map((entry) => ({
          ...entry,
          data: { version: 1 as const, type: "contract" as const },
        })),
      };
      expect(
        yield* owner.client.adminCatalog
          .import({ payload: wrongParentType, query: {} })
          .pipe(Effect.flip),
      ).toMatchObject({ collection: "entries", field: "catalogId" });
      const metadataChange = {
        ...payload,
        entries: [],
        interfaces: [],
        catalog: payload.catalog.map((record) => ({ ...record, search: ["curated new keyword"] })),
      };
      expect(
        yield* owner.client.adminCatalog.import({ payload: metadataChange, query: {} }),
      ).toMatchObject({ catalog: { updated: 1 } });
      expect((yield* repository.core.catalog.getById(catalogId))?.revision).toBe(2);
      expect(yield* repository.core.catalogEntry.getById(entryId)).toBeDefined();
    }),
  );

  it.effect("allows operators, rejects viewers and requires a trusted origin", () =>
    Effect.gen(function* () {
      yield* setup;
      const viewer = yield* platformIdentity("catalog-viewer@example.com", "viewer");
      expect(
        yield* viewer.client.adminCatalog.import({ payload, query: {} }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "PlatformAuthError" });
      const operator = yield* platformIdentity("catalog-operator@example.com", "operator");
      const untrustedOrigin = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${operator.token}`, origin: "https://untrusted.example" },
      });
      expect(
        yield* untrustedOrigin.adminCatalog.import({ payload, query: {} }).pipe(Effect.flip),
      ).toBeDefined();
      expect(yield* operator.client.adminCatalog.import({ payload, query: {} })).toMatchObject({
        catalog: { created: 1 },
      });
    }),
  );
});
