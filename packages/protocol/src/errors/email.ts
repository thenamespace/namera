import { Schema } from "effect";

export class EmailError extends Schema.TaggedError<EmailError>()("EmailError", {
  reason: Schema.Literals(["REQUEST_FAILED", "PROVIDER_REJECTED", "INVALID_RESPONSE"]),
  cause: Schema.Defect(),
}) {}
