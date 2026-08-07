import { Schema } from "effect";

export const NonEmptyString = Schema.String.pipe(Schema.check(Schema.isMinLength(1)));

export const MetadataName = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1, {
      message: "Name too short",
    }),
    Schema.isMaxLength(255, {
      message: "Name too long",
    }),
  ),
);

export const MetadataDescription = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1, {
      message: "Description too short",
    }),
    Schema.isMaxLength(1024, {
      message: "Description too long",
    }),
  ),
);

export const MetadataLogo = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("icon"),
    value: NonEmptyString,
    color: NonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("emoji"),
    value: NonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("image"),
    value: NonEmptyString,
  }),
]);

export const TimestampFields = {
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
};

export const OrganizationRoleKey = Schema.String.check(
  Schema.isPattern(/^[a-z0-9-]+$/, {
    message: "Key must use lowercase letters, numbers, and hyphens only",
  }),
  Schema.isMinLength(1, {
    message: "Key too short",
  }),
  Schema.isMaxLength(255, {
    message: "Key too long",
  }),
);

export const Permission = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9._-]*:[a-z][a-z0-9._-]*$/, {
    message: "Permission must use resource:action format",
  }),
);

export type OrganizationRoleKey = typeof OrganizationRoleKey.Type;
export type Permission = typeof Permission.Type;
