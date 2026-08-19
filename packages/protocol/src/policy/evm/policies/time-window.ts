import { DateTime, Schema } from "effect";

import { PolicyId } from "#/common/index";

const TimeWindowFields = {
  type: Schema.Literal("evm.time-window"),
  version: Schema.Literal(1),
  appliesTo: Schema.Literal("both"),
  startsAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  expiresAt: Schema.DateTimeUtcFromString,
};

const validTimeWindow = Schema.makeFilter<{
  readonly startsAt: DateTime.Utc | null;
  readonly expiresAt: DateTime.Utc;
}>((policy) =>
  policy.startsAt === null ||
  DateTime.toEpochMillis(policy.startsAt) < DateTime.toEpochMillis(policy.expiresAt)
    ? undefined
    : { path: ["expiresAt"], issue: "Expiration must be after the start time" },
);

export const CreateEvmTimeWindowPolicy = Schema.Struct(TimeWindowFields)
  .check(validTimeWindow)
  .annotate({
    identifier: "CreateEvmTimeWindowPolicy",
    description: "A stateless time window for an EVM session key",
  });

export const EvmTimeWindowPolicy = Schema.Struct({
  id: PolicyId,
  ...TimeWindowFields,
})
  .check(validTimeWindow)
  .annotate({
    identifier: "EvmTimeWindowPolicy",
    description: "A persisted stateless time window for an EVM session key",
  });

export type CreateEvmTimeWindowPolicy = typeof CreateEvmTimeWindowPolicy.Type;
export type EvmTimeWindowPolicy = typeof EvmTimeWindowPolicy.Type;
