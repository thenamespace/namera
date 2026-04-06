import { Schema } from "effect";
import { Struct } from "effect";

export const createUpdateSchema = <Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>,
) => {
  return schema.mapFields(Struct.map(Schema.optional));
};

export const createInsertSchema = <
  Fields extends Schema.Struct.Fields,
  Keys extends ReadonlyArray<keyof Fields>,
>(
  schema: Schema.Struct<Fields>,
  ...keys: Keys
) => {
  const partial = schema.mapFields(Struct.omit(keys)).mapFields(Struct.map(Schema.optional));
  const picked = schema.mapFields(Struct.pick(keys));
  return picked.mapFields(Struct.assign(partial.fields));
};
