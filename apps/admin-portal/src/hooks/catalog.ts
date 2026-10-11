import type { ListAdminCatalogRequest } from "@namera-ai/protocol/dto";

import { catalogAtom, importCatalogMutation } from "@/atoms/catalog";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export function useCatalog(query: ListAdminCatalogRequest) {
  return toQuery(() => catalogAtom(query))();
}
export const useImportCatalog = toMutation(importCatalogMutation, {
  invalidates: QueryKeys.catalog.list,
});
