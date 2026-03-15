import { Schema } from "effect";

export const EmptyArgs = Schema.Record(Schema.String, Schema.Unknown);
