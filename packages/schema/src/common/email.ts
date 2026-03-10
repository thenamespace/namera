import { Schema } from "effect";

export const emailRegex =
  /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-.]*)[a-z0-9_'+-]@([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/i;

export const Email = Schema.String.pipe(
  Schema.pattern(emailRegex, {
    message: () => "Invalid email address",
  }),
  Schema.brand("Email"),
);

export type Email = typeof Email.Type;
