import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  CatalogNotFoundError,
  type AddressCatalogId,
  type AddressCatalogEntryId,
  type ContractInterfaceId,
} from "@namera-ai/protocol";
import type {
  CatalogAddress,
  SearchCatalogRequest,
  ListAdminCatalogRequest,
} from "@namera-ai/protocol/dto";

import { requirePlatformPermission, type PlatformSession } from "#/auth/platform/access";

import { makeCatalogImport } from "./import.js";

export const makeCatalogApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const { catalog, catalogEntry, contractInterface } = repository.core;
  const importCatalog = yield* makeCatalogImport;
  const get = Effect.fn("application.catalog.get")(
    function* (id: AddressCatalogId) {
      const record = yield* catalog.getById(id);
      if (!record || record.status !== "published")
        return yield* new CatalogNotFoundError({ resource: "catalog", id });
      const entries = (yield* catalogEntry.listByCatalogId(id)).filter(
        (entry) => entry.status === "active",
      );
      return { ...record, entries };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  return {
    listAdmin: Effect.fn("application.catalog.listAdmin")(
      function* (context: PlatformSession, input: ListAdminCatalogRequest) {
        yield* requirePlatformPermission(repository, context, "catalog:read");
        const limit = input.limit ?? 25;
        const rows = yield* catalog.listAdmin(input);
        const page = rows.slice(0, limit);
        const deployments = yield* catalogEntry.listByCatalogIds(page.map((record) => record.id));
        const entries = [];
        for (const record of page) {
          entries.push({
            ...record,
            entries: deployments.filter((entry) => entry.catalogId === record.id),
          });
        }
        return { entries, nextOffset: rows.length > limit ? (input.offset ?? 0) + limit : null };
      },
      Effect.catchTag("DatabaseError", Effect.die),
    ),
    import: importCatalog,
    get,
    search: Effect.fn("application.catalog.search")(
      function* (input: SearchCatalogRequest) {
        const limit = input.limit ?? 20;
        const rows = yield* catalog.search(input);
        const page = rows.slice(0, limit);
        const deployments = yield* catalogEntry.listByCatalogIds(page.map((record) => record.id));
        const entries = [];
        for (const record of page) {
          entries.push({
            ...record,
            entries: deployments.filter(
              (entry) =>
                entry.catalogId === record.id &&
                entry.status === "active" &&
                (!input.chainId || entry.chainId === input.chainId),
            ),
          });
        }
        return {
          entries,
          nextOffset: rows.length > limit ? (input.offset ?? 0) + limit : null,
        };
      },
      Effect.catchTag("DatabaseError", Effect.die),
    ),
    getEntry: Effect.fn("application.catalog.getEntry")(
      function* (id: AddressCatalogEntryId) {
        const entry = yield* catalogEntry.getById(id);
        const parent = entry ? yield* catalog.getById(entry.catalogId) : undefined;
        if (!entry || entry.status !== "active" || parent?.status !== "published")
          return yield* new CatalogNotFoundError({ resource: "entry", id });
        return { catalog: parent, entry };
      },
      Effect.catchTag("DatabaseError", Effect.die),
    ),
    resolve: Effect.fn("application.catalog.resolve")(
      function* (addresses: readonly CatalogAddress[]) {
        const entries = yield* catalogEntry.findByAddresses(addresses);
        const parents = yield* catalog.getByIds([
          ...new Set(entries.map((entry) => entry.catalogId)),
        ]);
        const published = new Map(
          parents
            .filter((parent) => parent.status === "published")
            .map((parent) => [parent.id, parent]),
        );
        return addresses.map((address) => {
          const entry = entries.find(
            (candidate) =>
              candidate.status === "active" &&
              candidate.namespace === address.namespace &&
              candidate.chainId === address.chainId &&
              candidate.address === address.address.toLowerCase(),
          );
          const parent = entry && published.get(entry.catalogId);
          return { ...address, match: entry && parent ? { catalog: parent, entry } : null };
        });
      },
      Effect.catchTag("DatabaseError", Effect.die),
    ),
    getInterface: Effect.fn("application.catalog.getInterface")(
      function* (id: ContractInterfaceId) {
        if (!(yield* contractInterface.isPublished(id)))
          return yield* new CatalogNotFoundError({ resource: "interface", id });
        const record = yield* contractInterface.getById(id);
        if (!record) return yield* new CatalogNotFoundError({ resource: "interface", id });
        return record;
      },
      Effect.catchTag("DatabaseError", Effect.die),
    ),
  };
});
