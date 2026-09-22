import { Schema } from "effect";

import { Email, UserId } from "#/common/index";

/**
 * A user as an operator sees it. `metadata.name` is flattened and
 * `metadata.image` is deliberately omitted: the operator screens list and
 * search accounts, they do not render avatars.
 */
export const AdminUserEntry = Schema.Struct({
  id: UserId,
  email: Email,
  emailVerified: Schema.Boolean,
  name: Schema.NullOr(Schema.String),
  lastLoginAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
}).annotate({ identifier: "AdminUserEntry" });
export type AdminUserEntry = typeof AdminUserEntry.Type;

export const ListUsersRequest = Schema.Struct({
  limit: Schema.optionalKey(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 })),
  ),
  cursor: Schema.optionalKey(Schema.String),
  search: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(254))),
}).annotate({ identifier: "ListUsersRequest" });
export type ListUsersRequest = typeof ListUsersRequest.Type;

export const ListUsersResponse = Schema.Struct({
  entries: Schema.Array(AdminUserEntry),
  nextCursor: Schema.NullOr(Schema.String),
}).annotate({ identifier: "ListUsersResponse" });
