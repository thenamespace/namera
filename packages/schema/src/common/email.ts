import { Schema } from "effect";

export const emailRegex =
  /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-.]*)[a-z0-9_'+-]@([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/i;

export const Email = Schema.String.check(
  Schema.isPattern(emailRegex, {
    message: "Invalid email address",
  }),
).pipe(Schema.brand("Email"));

export type Email = typeof Email.Type;
