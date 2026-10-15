import type { AddressCatalogId } from "@namera-ai/protocol";
import type { ListAdminCatalogRequest } from "@namera-ai/protocol/dto";

import { catalogAtom, catalogDetailAtom, importCatalogMutation } from "@/atoms/catalog";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useCatalog = toQuery((query: ListAdminCatalogRequest) => catalogAtom(query));
export const useCatalogDetail = toQuery((id: AddressCatalogId) => catalogDetailAtom(id));
export const useImportCatalog = toMutation(importCatalogMutation, {
  invalidates: QueryKeys.catalog.list,
});
