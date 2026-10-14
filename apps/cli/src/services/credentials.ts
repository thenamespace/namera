import { Schema } from "effect";

import { Entry } from "@napi-rs/keyring";

import { cliFailure } from "./error-feedback.js";

export interface CredentialBundle {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: number;
  readonly scopes: ReadonlyArray<string>;
}

const StoredCredential = Schema.Struct({
  version: Schema.Literal(1),
  apiOrigin: Schema.NonEmptyString,
  generation: Schema.NonEmptyString,
  phase: Schema.Literals(["authorizing", "ready", "refreshing"]),
  accessToken: Schema.String,
  refreshToken: Schema.NullOr(Schema.String),
  expiresAt: Schema.Finite,
  scopes: Schema.Array(Schema.String),
});
export type StoredCredential = typeof StoredCredential.Type;

const entry = (profile: string) => new Entry("namera-cli", profile);

export const readCredentials = (profile: string): StoredCredential | undefined => {
  let value: string | null;
  try {
    value = entry(profile).getPassword();
  } catch {
    throw cliFailure("KEYRING_UNAVAILABLE");
  }
  if (value === null) return undefined;
  try {
    return Schema.decodeUnknownSync(Schema.fromJsonString(StoredCredential))(value);
  } catch {
    // Legacy bundles have no trustworthy origin/generation; require fresh consent.
    throw cliFailure("UNAUTHORIZED");
  }
};

export const writeCredentials = (profile: string, credentials: StoredCredential) => {
  try {
    entry(profile).setPassword(JSON.stringify(credentials));
  } catch {
    throw cliFailure("KEYRING_UNAVAILABLE");
  }
};

export const deleteCredentials = (profile: string) => {
  try {
    const credential = entry(profile);
    if (credential.getPassword() !== null) credential.deletePassword();
  } catch {
    throw cliFailure("KEYRING_UNAVAILABLE");
  }
};
