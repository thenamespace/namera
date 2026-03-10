import { Schema } from "effect";
import type { Struct } from "effect/Schema";

export const createUpdateSchema = <A, I, R>(schema: Schema.Schema<A, I, R>) => {
  return Schema.partial(schema);
};

export const createInsertSchema = <
  Fields extends Struct.Fields,
  Keys extends ReadonlyArray<keyof Fields>,
>(
  schema: Struct<Fields>,
  ...keys: Keys
) => {
  return Schema.extend(
    schema.pick(...keys),
    Schema.partial(schema.omit(...keys)),
  );
};
