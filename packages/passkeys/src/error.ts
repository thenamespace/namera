import { Schema } from "effect";

export class PasskeyError extends Schema.TaggedError<PasskeyError>()("PasskeyError", {
  operation: Schema.Literals([
    "generate-registration-options",
    "verify-registration",
    "generate-authentication-options",
    "verify-authentication",
  ]),
  cause: Schema.Defect(),
}) {}
