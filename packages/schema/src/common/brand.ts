import { Schema } from "effect";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export const SessionId = Schema.String.pipe(Schema.brand("SessionId"));
export const OrganizationId = Schema.String.pipe(
  Schema.brand("OrganizationId"),
);
export const OrganizationSlug = Schema.String.pipe(
  Schema.brand("OrganizationSlug"),
).check(
  Schema.isPattern(/^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$/, {
    message: "Invalid slug",
  }),
  Schema.isLengthBetween(3, 63, {
    message: "Slug must be between 3 and 63 characters",
  }),
);
export const SmartAccountId = Schema.String.pipe(
  Schema.brand("SmartAccountId"),
);
export const SessionKeyId = Schema.String.pipe(Schema.brand("SessionKeyId"));

export type SessionId = typeof SessionId.Type;
export type UserId = typeof UserId.Type;
export type OrganizationId = typeof OrganizationId.Type;
export type OrganizationSlug = typeof OrganizationSlug.Type;
export type SmartAccountId = typeof SmartAccountId.Type;
export type SessionKeyId = typeof SessionKeyId.Type;
