import { Schema } from "effect";

import { EthereumAddress } from "#/evm/primitives";

export const CatalogSourceUrl = Schema.URLFromString.check(
  Schema.makeFilter(
    (url) =>
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.href.length <= 2048,
    { message: "Expected an HTTPS URL without credentials" },
  ),
);

export const CatalogDisplay = Schema.Struct({
  name: Schema.String,
  logo: Schema.optionalKey(
    Schema.String.check(
      Schema.isMaxLength(255),
      Schema.isPattern(/^address-catalog\/[a-z0-9-]+\.(svg|png|webp)$/),
    ),
  ),
  description: Schema.optionalKey(Schema.String),
  website: Schema.optionalKey(CatalogSourceUrl),
  aliases: Schema.Array(Schema.String),
  tags: Schema.Array(Schema.String),
});

export const CatalogDeploymentVerification = Schema.Struct({
  sourceUrl: CatalogSourceUrl,
  checkedAt: Schema.DateTimeUtcFromString,
  implementationAddress: Schema.optionalKey(EthereumAddress),
});
