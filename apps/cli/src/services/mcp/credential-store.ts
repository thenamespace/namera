import { createHash } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Schema } from "effect";

import { Entry } from "@napi-rs/keyring";

import { cliConfigPath } from "../config.js";
import { cliFailure } from "../error-feedback.js";

export const McpProfile = Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9_-]{1,64}$/));
export const McpCredential = Schema.Struct({
  version: Schema.Literal(1),
  generation: Schema.String,
  phase: Schema.Literals(["ready", "refreshing", "authorizing", "signed-out"]),
  clientId: Schema.String,
  accessToken: Schema.String,
  refreshToken: Schema.NullOr(Schema.String),
  expiresAt: Schema.Number,
  scopes: Schema.Array(Schema.Literals(["mcp:read", "mcp:execute", "offline_access"])),
});
export type McpCredential = typeof McpCredential.Type;

export interface McpCredentialStore {
  readonly read: () => McpCredential | undefined;
  readonly write: (credentials: McpCredential) => void;
  readonly lock: <A>(run: () => Promise<A>) => Promise<A>;
}

// Refresh tokens rotate once. Every process must reread them under this lock.
export const withCredentialLock = async <A>(path: string, run: () => Promise<A>): Promise<A> => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  // SQLite's OS lock is released on process death. This database holds no
  // credentials or application rows, only a cross-process transaction lock.
  const database = new DatabaseSync(path);
  try {
    if (process.platform !== "win32") await chmod(path, 0o600);
    database.exec("PRAGMA busy_timeout = 0");
    for (let attempt = 0; attempt < 200; attempt += 1) {
      try {
        database.exec("BEGIN IMMEDIATE");
      } catch (error) {
        if ((error as { errcode?: number }).errcode !== 5) throw error;
        // oxlint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      try {
        // oxlint-disable-next-line no-await-in-loop
        return await run();
      } finally {
        database.exec("ROLLBACK");
      }
    }
    throw cliFailure("AUTH_BUSY");
  } finally {
    database.close();
  }
};

export const mcpCredentialStore = (apiOrigin: string, profile: string): McpCredentialStore => {
  Schema.decodeUnknownSync(McpProfile)(profile);
  const key = createHash("sha256").update(`${apiOrigin}\n${profile}`).digest("hex");
  const entry = () => new Entry("namera-mcp", key);
  return {
    read: () => {
      try {
        const raw = entry().getPassword();
        return raw === null
          ? undefined
          : Schema.decodeUnknownSync(Schema.fromJsonString(McpCredential))(raw);
      } catch {
        throw cliFailure("KEYRING_UNAVAILABLE");
      }
    },
    write: (credentials) => {
      try {
        entry().setPassword(JSON.stringify(credentials));
      } catch {
        throw cliFailure("KEYRING_UNAVAILABLE");
      }
    },
    lock: (run) =>
      withCredentialLock(join(dirname(cliConfigPath), "mcp", `${key}.lock.sqlite`), run),
  };
};
