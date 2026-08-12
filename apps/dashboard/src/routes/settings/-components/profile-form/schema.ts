import { Schema } from "effect";

import { Email } from "@namera-ai/protocol";
import { MetadataName } from "@namera-ai/protocol/model";

export const ProfileFormSchema = Schema.Struct({
  image: Schema.String,
  email: Email,
  name: MetadataName,
});

export const ProfileFormValidator = Schema.toStandardSchemaV1(ProfileFormSchema);

export type ProfileFormInput = typeof ProfileFormSchema.Encoded;
export type ProfileFormOutput = typeof ProfileFormSchema.Type;
