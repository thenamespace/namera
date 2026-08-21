import { Schema } from "effect";

const NullableString = Schema.optionalKey(Schema.NullOr(Schema.String));
const NullableBoolean = Schema.optionalKey(Schema.NullOr(Schema.Boolean));

export const BlockscoutToken = Schema.Struct({
  address_hash: Schema.String,
  circulating_market_cap: NullableString,
  decimals: NullableString,
  exchange_rate: NullableString,
  holders_count: NullableString,
  icon_url: NullableString,
  name: NullableString,
  reputation: NullableString,
  symbol: NullableString,
  total_supply: NullableString,
  type: NullableString,
});

export const BlockscoutAddress = Schema.Struct({
  coin_balance: NullableString,
  ens_domain_name: NullableString,
  exchange_rate: NullableString,
  hash: Schema.String,
  implementations: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        address: Schema.String,
        name: NullableString,
      }),
    ),
  ),
  is_contract: NullableBoolean,
  is_scam: NullableBoolean,
  is_verified: NullableBoolean,
  name: NullableString,
  proxy_type: NullableString,
  reputation: NullableString,
  token: Schema.optionalKey(Schema.NullOr(BlockscoutToken)),
});

export const BlockscoutAddressTokens = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      token: BlockscoutToken,
      value: Schema.String,
    }),
  ),
  next_page_params: Schema.optionalKey(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
});

export const BlockscoutSearch = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      address_hash: Schema.optionalKey(Schema.String),
      icon_url: NullableString,
      name: NullableString,
      reputation: NullableString,
      symbol: NullableString,
      token_type: NullableString,
      type: Schema.optionalKey(Schema.String),
    }),
  ),
  next_page_params: Schema.optionalKey(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
});

export const BlockscoutMetadata = Schema.Struct({
  addresses: Schema.Record(
    Schema.String,
    Schema.Struct({
      tags: Schema.optionalKey(
        Schema.Array(
          Schema.Struct({
            meta: Schema.optionalKey(Schema.NullOr(Schema.String)),
            name: Schema.String,
            ordinal: Schema.optionalKey(Schema.Number),
            slug: Schema.String,
            tagType: Schema.String,
          }),
        ),
      ),
    }),
  ),
});

export type BlockscoutAddress = typeof BlockscoutAddress.Type;
export type BlockscoutToken = typeof BlockscoutToken.Type;
export type BlockscoutMetadata = typeof BlockscoutMetadata.Type;
