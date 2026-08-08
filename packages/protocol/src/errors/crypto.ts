import { Schema } from "effect";

export class CryptoError extends Schema.TaggedError<CryptoError>()("CryptoError", {
  cause: Schema.Defect(),
}) {}
