import { Schema } from "effect";

export const SessionExportForm = Schema.Struct({
  password: Schema.String.check(Schema.isMinLength(12)),
  confirmation: Schema.String,
}).check(
  Schema.makeFilter(({ password, confirmation }) =>
    password === confirmation
      ? undefined
      : { path: ["confirmation"], issue: "Passphrases must match" },
  ),
);
