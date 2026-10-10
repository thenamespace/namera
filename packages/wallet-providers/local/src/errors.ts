import { Schema } from "effect";
export class LocalKeyError extends Schema.TaggedError<LocalKeyError>()("LocalKeyError", {
  operation: Schema.Literals(["create", "sign", "disable", "destroy"]),
  cause: Schema.Defect(),
}) {}
