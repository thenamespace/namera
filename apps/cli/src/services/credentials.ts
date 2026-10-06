import { Entry } from "@napi-rs/keyring";

import { cliFailure } from "./error-feedback.js";

export interface CredentialBundle {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: number;
  readonly scopes: ReadonlyArray<string>;
}

const entry = (profile: string) => new Entry("namera-cli", profile);

export const readCredentials = (profile: string): CredentialBundle | undefined => {
  try {
    const value = entry(profile).getPassword();
    return value === null ? undefined : (JSON.parse(value) as CredentialBundle);
  } catch {
    throw cliFailure("KEYRING_UNAVAILABLE");
  }
};

export const writeCredentials = (profile: string, credentials: CredentialBundle) => {
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
