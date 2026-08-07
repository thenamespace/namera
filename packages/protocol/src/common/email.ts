import { Schema, SchemaGetter } from "effect";

export const emailRegex =
  /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-.]*)[a-z0-9_'+-]@([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/i;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const Email = Schema.String.pipe(
  Schema.decode({
    decode: SchemaGetter.transform(normalizeEmail),
    encode: SchemaGetter.transform(normalizeEmail),
  }),
)
  .check(
    Schema.isPattern(emailRegex, {
      message: "Invalid email address",
    }),
  )
  .pipe(Schema.brand("Email"));

export type Email = typeof Email.Type;
