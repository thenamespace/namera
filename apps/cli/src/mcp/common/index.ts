import { Schema } from "effect";

export const EmptyArgs = Schema.Record(Schema.String, Schema.Unknown);

export class InsufficientPermissions extends Schema.TaggedErrorClass<InsufficientPermissions>()(
  "InsufficientPermissions",
  {},
) {}
