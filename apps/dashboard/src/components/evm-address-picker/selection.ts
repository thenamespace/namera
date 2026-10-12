import type { CatalogEntryView } from "@namera-ai/protocol/dto";

import type { EvmAddressSelection, EvmCatalogType } from "./types";

export function catalogSelection<T extends EvmCatalogType>(
  match: typeof CatalogEntryView.Type,
  types: readonly T[],
): EvmAddressSelection<T> | null {
  const type = match.catalog.data.type;
  if (
    !types.some((allowed) => allowed === type) ||
    match.entry.data.type !== type ||
    match.entry.catalogId !== match.catalog.id
  )
    return null;
  // The transport DTO has independent unions; these checks establish the correlated pair.
  return {
    source: "catalog",
    type,
    catalog: match.catalog,
    deployment: match.entry,
  } as EvmAddressSelection<T>;
}
