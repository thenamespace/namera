import { Schema } from "effect";

import { EnsLabel, WalletId } from "#/common/index";

const RecordKey = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128));
const RecordValue = Schema.String.check(Schema.isMaxLength(4096));

export const IdentityAccountParams = Schema.Struct({ walletId: WalletId });
export const IdentityParams = Schema.Struct({ walletId: WalletId, label: EnsLabel });
export const IdentityListQuery = Schema.Struct({
  page: Schema.optional(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  ),
});
export const CreateIdentityRequest = Schema.Struct({ label: EnsLabel });
export const IdentityView = Schema.Struct({
  fullName: Schema.String,
  label: EnsLabel,
  owner: Schema.String,
  texts: Schema.Record(Schema.String, Schema.String),
  addresses: Schema.Record(Schema.String, Schema.String),
  contenthash: Schema.NullOr(Schema.String),
});
export const IdentityDetail = Schema.Struct({
  ...IdentityView.fields,
  records: Schema.Record(Schema.String, Schema.Json),
});
export const IdentityListResponse = Schema.Struct({
  items: Schema.Array(IdentityView),
  page: Schema.Number,
  totalItems: Schema.Number,
  size: Schema.Number,
});
export const IdentityRecordChange = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("text"),
    key: RecordKey,
    value: Schema.NullOr(RecordValue),
  }),
  Schema.Struct({
    type: Schema.Literal("address"),
    key: RecordKey,
    value: Schema.NullOr(RecordValue),
  }),
  Schema.Struct({ type: Schema.Literal("data"), key: RecordKey, value: Schema.Json }),
]);
export const UpdateIdentityRecordsRequest = Schema.Struct({
  // null removes a record, including a data record.
  changes: Schema.Array(IdentityRecordChange).check(Schema.isMinLength(1), Schema.isMaxLength(20)),
});
export const IdentityNetworksResponse = Schema.Array(
  Schema.Struct({
    key: Schema.String,
    label: Schema.String,
    coinType: Schema.String,
  }),
);

export type IdentityView = typeof IdentityView.Type;
export type IdentityDetail = typeof IdentityDetail.Type;
export type IdentityRecordChange = typeof IdentityRecordChange.Type;
export type UpdateIdentityRecordsRequest = typeof UpdateIdentityRecordsRequest.Type;
