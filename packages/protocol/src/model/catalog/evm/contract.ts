import { Schema } from "effect";

import { CatalogDeploymentVerification, CatalogDisplay } from "../common.js";

export const EvmContractCatalogData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("contract"),
  display: CatalogDisplay,
  details: Schema.Struct({
    protocol: Schema.optionalKey(Schema.String),
    contractVersion: Schema.optionalKey(Schema.String),
  }),
});

export const EvmContractCatalogEntryData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("contract"),
  verification: Schema.optionalKey(CatalogDeploymentVerification),
});
