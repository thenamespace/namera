import { Schema } from "effect";

export class PasskeyError extends Schema.TaggedError<PasskeyError>()("PasskeyError", {
  operation: Schema.Literals(["generate-registration-options", "verify-registration"]),
  cause: Schema.Defect(),
}) {}
