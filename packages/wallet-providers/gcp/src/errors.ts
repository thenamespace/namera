import { Schema } from "effect";
export class GcpKeyError extends Schema.TaggedError<GcpKeyError>()("GcpKeyError", {
  operation: Schema.Literals(["create", "sign", "disable", "destroy"]),
  cause: Schema.Defect(),
}) {}
