import { Schema } from "effect";

export const TimestampFields = {
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
  deletedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
};

export const MetadataName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[a-zA-Z0-9\-_ ]+$/, {
      message:
        "Name can only contain letters, numbers, spaces, hyphens and underscores",
    }),
    Schema.isLengthBetween(1, 255, {
      message: "Name must be between 1 and 255 characters",
    }),
  ),
);

export const MetadataDescription = Schema.optionalKey(
  Schema.String.pipe(
    Schema.check(
      Schema.isLengthBetween(0, 1084, {
        message: "Description must be between 0 and 1084 characters",
      }),
    ),
  ),
);

export const MetadataLogo = Schema.Struct({
  type: Schema.Literals(["icon", "emoji", "image"]),
  value: Schema.String,
});

export type MetadataName = typeof MetadataName.Type;
export type MetadataDescription = typeof MetadataDescription.Type;
export type MetadataLogo = typeof MetadataLogo.Type;
