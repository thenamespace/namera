import { readFile } from "node:fs/promises";

import { expect, it as test, layer } from "@effect/vitest";
import { Effect } from "effect";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";

import { Database, TestDatabase } from "../../src/index.js";

layer(TestDatabase.layer)("database migrations", (it) => {
  it.effect("removes legacy wallet-key persistence and retains signing keys", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      const tables = yield* database
        .select({ tablename: sql<string>`tablename` })
        .from(sql`pg_tables`)
        .where(sql`schemaname = 'core' and tablename in ('wallet_key', 'signing_key')`);
      expect(tables.map(({ tablename }) => tablename)).toEqual(["signing_key"]);
    }),
  );

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

test("preserves populated legacy wallet-key tables until their rows are reviewed", async () => {
  const migration = await readFile(
    new URL(
      "../../migrations/20261008182104_remove-legacy-wallet-key/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const database = new PGlite();
  try {
    await database.exec(`
      CREATE SCHEMA core;
      CREATE TABLE core.wallet_key (id text PRIMARY KEY);
      INSERT INTO core.wallet_key VALUES ('legacy-key');
    `);
    await expect(database.exec(migration)).rejects.toThrow(
      "core.wallet_key still contains legacy rows",
    );
    expect((await database.query("SELECT id FROM core.wallet_key")).rows).toEqual([
      { id: "legacy-key" },
    ]);
    await database.exec("DELETE FROM core.wallet_key");
    await database.exec(migration);
    expect((await database.query("SELECT to_regclass('core.wallet_key') AS name")).rows).toEqual([
      { name: null },
    ]);
  } finally {
    await database.close();
  }
});
