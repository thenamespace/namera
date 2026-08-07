// oxlint-disable typescript/no-explicit-any
import { Schema, Struct } from "effect";

// Update Schema
export const createStructUpdateSchema = <Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>,
) => {
  return schema.mapFields(Struct.map(Schema.optional));
};

export const createStructUnionUpdateSchema = <Members extends ReadonlyArray<Schema.Struct<any>>>(
  schema: Schema.Union<Members>,
) => {
  type PartialMembers = {
    [K in keyof Members]: Members[K] extends Schema.Struct<infer F>
      ? ReturnType<typeof createStructUpdateSchema<F>>
      : never;
  };

  return Schema.Union(
    schema.members.map((m) => m.mapFields(Struct.map(Schema.optional))) as PartialMembers,
  );
};

export function createUpdateSchema<Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>,
): ReturnType<typeof createStructUpdateSchema<Fields>>;

export function createUpdateSchema<
  Members extends readonly [Schema.Struct<any>, ...Schema.Struct<any>[]],
>(schema: Schema.Union<Members>): ReturnType<typeof createStructUnionUpdateSchema<Members>>;

export function createUpdateSchema(schema: any): any {
  if ("fields" in schema) {
    return createStructUpdateSchema(schema);
  }
  return createStructUnionUpdateSchema(schema);
}

// Insert Schema
export const createStructInsertSchema = <
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

type UnionKeys<Members extends readonly Schema.Struct<any>[]> =
  Members[number] extends Schema.Struct<infer F> ? keyof F : never;

export const createStructUnionInsertSchema = <
  Members extends readonly [Schema.Struct<any>, ...Schema.Struct<any>[]],
  Keys extends ReadonlyArray<UnionKeys<Members>>,
>(
  schema: Schema.Union<Members>,
  ...keys: Keys
) => {
  type InsertMembers = {
    [K in keyof Members]: Members[K] extends Schema.Struct<infer F>
      ? ReturnType<typeof createStructInsertSchema<F, Extract<Keys[number], keyof F>[]>>
      : never;
  };

  return Schema.Union(
    schema.members.map((m: any) => {
      // Runtime check: Filter out keys that don't belong to this specific struct
      // before passing them to Struct.pick/omit.
      const validKeys = keys.filter((k) => k in m.fields);
      return createStructInsertSchema(m, ...validKeys);
    }) as any,
  ) as Schema.Union<InsertMembers>;
};

export function createInsertSchema<
  Fields extends Schema.Struct.Fields,
  Keys extends ReadonlyArray<keyof Fields>,
>(
  schema: Schema.Struct<Fields>,
  ...keys: Keys
): ReturnType<typeof createStructInsertSchema<Fields, Keys>>;

export function createInsertSchema<
  Members extends readonly [Schema.Struct<any>, ...Schema.Struct<any>[]],
  Keys extends ReadonlyArray<UnionKeys<Members>>,
>(
  schema: Schema.Union<Members>,
  ...keys: Keys
): ReturnType<typeof createStructUnionInsertSchema<Members, Keys>>;

export function createInsertSchema(schema: any, ...keys: any[]): any {
  if ("fields" in schema) {
    return createStructInsertSchema(schema, ...keys);
  }
  return createStructUnionInsertSchema(schema, ...keys);
}
