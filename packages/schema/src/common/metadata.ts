import { Schema } from "effect";

export const MetadataIcon = Schema.Struct({
  type: Schema.Literals(["icon", "emoji", "image"]),
  value: Schema.String,
});

export type MetadataIcon = typeof MetadataIcon.Type;

export const MetadataName = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9-_ ]+$/, {
    message:
      "Name must be alphanumeric and can contain hyphens, underscores and spaces",
  }),
  Schema.isLengthBetween(3, 128, {
    message: "Name must be between 3 and 128 characters long",
  }),
);

export const MetadataDescription = Schema.String.check(
  Schema.isLengthBetween(3, 1024, {
    message: "Description must be between 3 and 1024 characters long",
  }),
);

export type MetadataName = typeof MetadataName.Type;
export type MetadataDescription = typeof MetadataDescription.Type;
