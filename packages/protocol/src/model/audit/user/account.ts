import { Schema } from "effect";

export const UserCreatedEventData = Schema.Struct({
  event: Schema.Literal("user.created"),
  data: Schema.Struct({
    version: Schema.Literal(1),
  }),
});

export const UserSignedInEventData = Schema.Struct({
  event: Schema.Literal("user.signed_in"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    method: Schema.Literals(["magic-link", "google"]),
    ipAddress: Schema.NullOr(Schema.String),
    userAgent: Schema.NullOr(Schema.String),
  }),
});

export const UserAccountChangedEventData = Schema.Struct({
  event: Schema.Literals(["user.account_linked", "user.account_unlinked"]),
  data: Schema.Struct({
    version: Schema.Literal(1),
    provider: Schema.Literal("google"),
    accountId: Schema.String,
  }),
});

export const UserUpdatedEventData = Schema.Struct({
  event: Schema.Literal("user.updated"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    changedFields: Schema.Array(Schema.Literals(["name", "image"])),
  }),
});
