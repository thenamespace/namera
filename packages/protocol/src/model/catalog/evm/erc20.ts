import { Schema } from "effect";

import { CatalogDeploymentVerification, CatalogDisplay } from "../common.js";

export const Erc20CatalogData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("erc20"),
  display: CatalogDisplay,
  details: Schema.Struct({ symbol: Schema.String }),
});

export const Erc20CatalogEntryData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("erc20"),
  decimals: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 255 })),
  verification: Schema.optionalKey(CatalogDeploymentVerification),
});
