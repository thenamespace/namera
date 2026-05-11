import { Schema } from "effect";

export const ProfileUpdateSchema = Schema.Struct({
  fullName: Schema.String.check(
    Schema.isLengthBetween(1, 255, {
      message: "Name must be between 1 and 255 characters",
    }),
  ),
});

export type ProfileUpdateSchema = typeof ProfileUpdateSchema.Type;
