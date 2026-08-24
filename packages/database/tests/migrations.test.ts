import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { sql } from "drizzle-orm";

import { Database, TestDatabase } from "../src/index.js";

layer(TestDatabase.layer)("database migrations", (it) => {
  it.effect("loads pg_trgm and creates the address metadata search indexes", () =>
    Effect.gen(function* () {
      const database = yield* Database;

      const extensions = yield* database
        .select({ extname: sql<string>`extname` })
        .from(sql`pg_extension`)
        .where(sql`extname = 'pg_trgm'`);
      const indexes = yield* database
        .select({ indexname: sql<string>`indexname` })
        .from(sql`pg_indexes`)
        .where(sql`
          schemaname = 'core'
          and tablename = 'address_metadata'
          and indexname in (
            'address_metadata_display_name_trgm_idx',
            'address_metadata_token_symbol_trgm_idx'
          )
        `)
        .orderBy(sql`indexname`);

      expect(extensions.map(({ extname }) => extname)).toEqual(["pg_trgm"]);
      expect(indexes.map(({ indexname }) => indexname)).toEqual([
        "address_metadata_display_name_trgm_idx",
        "address_metadata_token_symbol_trgm_idx",
      ]);
    }),
  );
});
