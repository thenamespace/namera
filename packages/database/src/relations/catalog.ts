import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const catalogRelations = defineRelationsPart(schema, (r) => ({
  addressCatalog: {
    // One namespace-scoped resource may have several deployments on each chain.
    entries: r.many.addressCatalogEntry({
      from: [r.addressCatalog.id, r.addressCatalog.namespace],
      to: [r.addressCatalogEntry.catalogId, r.addressCatalogEntry.namespace],
    }),
  },
  addressCatalogEntry: {
    // The composite reference prevents deployments from crossing namespaces.
    catalog: r.one.addressCatalog({
      from: [r.addressCatalogEntry.catalogId, r.addressCatalogEntry.namespace],
      to: [r.addressCatalog.id, r.addressCatalog.namespace],
      optional: false,
    }),
    // Metadata-only entries can exist without an assigned interface.
    interface: r.one.contractInterface({
      from: r.addressCatalogEntry.interfaceId,
      to: r.contractInterface.id,
    }),
  },
  contractInterface: {
    // Identical interface documents can be shared by independent deployments.
    entries: r.many.addressCatalogEntry({
      from: r.contractInterface.id,
      to: r.addressCatalogEntry.interfaceId,
    }),
  },
}));
