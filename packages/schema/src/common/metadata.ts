import { Schema } from "effect";

export const MetadataIcon = Schema.Struct({
  type: Schema.Literals(["icon", "emoji", "image"]),
  value: Schema.String,
});

export type MetadataIcon = typeof MetadataIcon.Type;
