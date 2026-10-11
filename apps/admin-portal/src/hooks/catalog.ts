import type { AddressCatalogId } from "@namera-ai/protocol";
import type { ListAdminCatalogRequest } from "@namera-ai/protocol/dto";

import { catalogAtom, catalogDetailAtom, importCatalogMutation } from "@/atoms/catalog";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export function useCatalog(query: ListAdminCatalogRequest) {
  return toQuery(() => catalogAtom(query))();
}
export function useCatalogDetail(id: AddressCatalogId) {
  return toQuery(() => catalogDetailAtom(id))();
}
export const useImportCatalog = toMutation(importCatalogMutation, {
  invalidates: QueryKeys.catalog.list,
});
