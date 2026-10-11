import type { AddressCatalogId } from "@namera-ai/protocol";
import type { ListAdminCatalogRequest } from "@namera-ai/protocol/dto";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const catalogAtom = (query: ListAdminCatalogRequest = { namespace: "eip155" }) =>
  NameraClient.query("adminCatalog", "list", {
    query: { limit: 25, ...query },
    reactivityKeys: QueryKeys.catalog.list,
    timeToLive: "30 seconds",
  });
export const importCatalogMutation = NameraClient.mutation("adminCatalog", "import");
export const catalogDetailAtom = (catalogId: AddressCatalogId) =>
  NameraClient.query("adminCatalog", "get", {
    params: { catalogId },
    reactivityKeys: QueryKeys.catalog.list,
    timeToLive: "30 seconds",
  });
