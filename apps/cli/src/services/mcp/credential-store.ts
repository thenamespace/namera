import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

import { Schema } from "effect";

import { Entry } from "@napi-rs/keyring";

import { cliConfigPath } from "../config.js";
import { withCredentialLock } from "../credential-lock.js";
import { cliFailure } from "../error-feedback.js";

export { withCredentialLock } from "../credential-lock.js";

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
