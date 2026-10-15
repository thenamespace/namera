import { Effect, Predicate, Schema } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { CatalogImportError } from "@namera-ai/protocol";
import {
  ImportCatalogRecord,
  ImportCatalogEntry,
  type ImportCatalogRequest,
} from "@namera-ai/protocol/dto";
import { EthereumAddress } from "@namera-ai/protocol/evm";
import { Base64 } from "@namera-ai/utils";

import { requirePlatformPermission, type PlatformSession } from "#/auth/platform/access";

// Sort object keys, retaining ABI array order and all validated document fields.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, nested: unknown) =>
    Predicate.isObject(nested)
      ? Object.fromEntries(
          Object.keys(nested)
            .toSorted()
            .map((key) => [key, nested[key]]),
        )
      : nested,
  );

const unique = <A extends { readonly id: string }>(
  collection: CatalogImportError["collection"],
  records: readonly A[],
  key: (record: A) => string,
  field: string,
) =>
  Effect.gen(function* () {
    const seen = new Set<string>();
    for (const record of records) {
      const value = key(record);
      if (seen.has(value)) {
        return yield* new CatalogImportError({
          collection,
          id: record.id,
          field,
          message: "Duplicate value in upload",
        });
      }
      seen.add(value);
    }
  });

export const makeCatalogImport = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const crypto = yield* CryptoService;
  const { catalog, catalogEntry, contractInterface } = repository.core;

  return Effect.fn("application.catalog.import")(
    function* (context: PlatformSession, input: ImportCatalogRequest, dryRun = false) {
      // Check access before expensive ABI hashing, then repeat under the team lock.
      yield* requirePlatformPermission(repository, context, "catalog:manage");

      const entries = input.entries.map((entry) => ({
        ...entry,
        address: Schema.decodeUnknownSync(EthereumAddress)(entry.address.toLowerCase()),
      }));
      yield* unique("catalog", input.catalog, (record) => record.id, "id");
      yield* unique(
        "catalog",
        input.catalog,
        (record) => `${record.namespace}:${record.slug}`,
        "slug",
      );
      yield* unique("entries", entries, (record) => record.id, "id");
      yield* unique(
        "entries",
        entries,
        (record) => `${record.namespace}:${record.chainId}:${record.address}`,
        "address",
      );
      yield* unique("interfaces", input.interfaces, (record) => record.id, "id");

      const interfaces = yield* Effect.forEach(input.interfaces, (record) =>
        Effect.gen(function* () {
          const hash = yield* crypto.sha256(canonical(record.document));
          const contentHash = Array.from(Base64.toUint8Array(hash), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          return { ...record, contentHash };
        }),
      );
      yield* unique("interfaces", interfaces, (record) => record.contentHash, "document");

      return yield* transaction.run(
        Effect.gen(function* () {
          // Shared with role mutations; also serializes all catalog imports across replicas.
          yield* repository.auth.platform.lockTeam();
          const actor = yield* requirePlatformPermission(repository, context, "catalog:manage");

          const parents = yield* catalog.getByIds([
            ...new Set([
              ...input.catalog.map((record) => record.id),
              ...entries.map((entry) => entry.catalogId),
            ]),
          ]);
          const parentMap = new Map(parents.map((record) => [record.id, record]));
          const slugs = yield* catalog.findBySlugs(input.catalog.map((record) => record.slug));
          for (const record of input.catalog) {
            const duplicate = slugs.find(
              (row) =>
                row.namespace === record.namespace &&
                row.slug === record.slug &&
                row.id !== record.id,
            );
            if (duplicate)
              return yield* new CatalogImportError({
                collection: "catalog",
                id: record.id,
                field: "slug",
                message: `Already belongs to ${duplicate.id}`,
              });
            const previous = parentMap.get(record.id);
            if (
              previous &&
              (previous.namespace !== record.namespace || previous.data.type !== record.data.type)
            )
              return yield* new CatalogImportError({
                collection: "catalog",
                id: record.id,
                field: "data.type",
                message: "Namespace and resource type are immutable; use a new ID",
              });
          }

          const interfaceIds = [
            ...new Set([
              ...interfaces.map((record) => record.id),
              ...entries.flatMap((entry) => (entry.interfaceId ? [entry.interfaceId] : [])),
            ]),
          ];
          const storedInterfaces = yield* contractInterface.getByIds(interfaceIds);
          const interfaceMap = new Map(storedInterfaces.map((record) => [record.id, record]));
          const hashes = yield* contractInterface.findByHashes(
            interfaces.map((record) => record.contentHash),
          );
          const newInterfaces = [];
          const updatedInterfaces = [];
          for (const record of interfaces) {
            const previous = interfaceMap.get(record.id);
            if (
              previous &&
              (previous.contentHash !== record.contentHash ||
                previous.format !== record.format ||
                previous.sourceUrl.href !== record.sourceUrl.href)
            )
              return yield* new CatalogImportError({
                collection: "interfaces",
                id: record.id,
                field: "document",
                message: "Interface records are immutable; use a new ID for a new ABI",
              });
            const duplicate = hashes.find(
              (row) => row.contentHash === record.contentHash && row.id !== record.id,
            );
            if (duplicate)
              return yield* new CatalogImportError({
                collection: "interfaces",
                id: record.id,
                field: "document",
                message: `ABI already belongs to ${duplicate.id}; reference that ID`,
              });
            if (!previous) newInterfaces.push(record);
            else if (canonical(previous.data) !== canonical(record.data))
              updatedInterfaces.push(record);
          }

          const storedEntries = yield* catalogEntry.getByIds(entries.map((entry) => entry.id));
          const entryMap = new Map(storedEntries.map((entry) => [entry.id, entry]));
          const addresses = yield* catalogEntry.findByAddresses(entries);
          const incomingParents = new Map(input.catalog.map((record) => [record.id, record]));
          const incomingInterfaces = new Set(interfaces.map((record) => record.id));
          for (const entry of entries) {
            const parent = incomingParents.get(entry.catalogId) ?? parentMap.get(entry.catalogId);
            if (
              !parent ||
              parent.namespace !== entry.namespace ||
              parent.data.type !== entry.data.type
            )
              return yield* new CatalogImportError({
                collection: "entries",
                id: entry.id,
                field: "catalogId",
                message: "Parent must exist and match namespace and data type",
              });
            if (
              entry.interfaceId &&
              !incomingInterfaces.has(entry.interfaceId) &&
              !interfaceMap.has(entry.interfaceId)
            )
              return yield* new CatalogImportError({
                collection: "entries",
                id: entry.id,
                field: "interfaceId",
                message: "Interface does not exist in the database or upload",
              });
            const duplicate = addresses.find(
              (row) =>
                row.chainId === entry.chainId &&
                row.address === entry.address &&
                row.id !== entry.id,
            );
            if (duplicate)
              return yield* new CatalogImportError({
                collection: "entries",
                id: entry.id,
                field: "address",
                message: `Address already belongs to ${duplicate.id}`,
              });
            const previous = entryMap.get(entry.id);
            if (
              previous &&
              (previous.catalogId !== entry.catalogId ||
                previous.namespace !== entry.namespace ||
                previous.chainId !== entry.chainId ||
                previous.address !== entry.address)
            )
              return yield* new CatalogImportError({
                collection: "entries",
                id: entry.id,
                field: "address",
                message: "Deployment identity is immutable; disable it and create a new entry",
              });
            if (
              previous &&
              previous.interfaceId !== entry.interfaceId &&
              entry.data.verification &&
              canonical(entry.data.verification) === canonical(previous.data.verification)
            )
              return yield* new CatalogImportError({
                collection: "entries",
                id: entry.id,
                field: "data.verification",
                message:
                  "Changing the interface requires renewed verification or removing old evidence",
              });
          }

          const changedCatalog = input.catalog.filter((record) => {
            const previous = parentMap.get(record.id);
            return (
              !previous ||
              canonical(Schema.encodeSync(ImportCatalogRecord)(previous)) !==
                canonical(Schema.encodeSync(ImportCatalogRecord)(record))
            );
          });
          const changedEntries = entries.filter((entry) => {
            const previous = entryMap.get(entry.id);
            return (
              !previous ||
              canonical(Schema.encodeSync(ImportCatalogEntry)(previous)) !==
                canonical(Schema.encodeSync(ImportCatalogEntry)(entry))
            );
          });
          const catalogCreated = changedCatalog.filter(
            (record) => !parentMap.has(record.id),
          ).length;
          const entriesCreated = changedEntries.filter((record) => !entryMap.has(record.id)).length;

          if (!dryRun) {
            yield* contractInterface.insertMany(newInterfaces);
            for (const record of updatedInterfaces)
              yield* contractInterface.updateData(record.id, record.data);
            yield* catalog.upsertMany(changedCatalog);
            yield* catalogEntry.upsertMany(changedEntries);
            if (
              changedCatalog.length ||
              changedEntries.length ||
              newInterfaces.length ||
              updatedInterfaces.length
            )
              yield* repository.auth.platform.appendEvent(actor.id, {
                version: 1,
                type: "catalog.imported",
                catalogIds: changedCatalog.map((record) => record.id),
                entryIds: changedEntries.map((record) => record.id),
                interfaceIds: [...newInterfaces, ...updatedInterfaces].map((record) => record.id),
              });
          }

          return {
            dryRun,
            catalog: {
              created: catalogCreated,
              updated: changedCatalog.length - catalogCreated,
              unchanged: input.catalog.length - changedCatalog.length,
            },
            entries: {
              created: entriesCreated,
              updated: changedEntries.length - entriesCreated,
              unchanged: entries.length - changedEntries.length,
            },
            interfaces: {
              created: newInterfaces.length,
              updated: updatedInterfaces.length,
              unchanged: interfaces.length - newInterfaces.length - updatedInterfaces.length,
            },
          };
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
