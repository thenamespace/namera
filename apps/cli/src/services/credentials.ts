import { Entry } from "@napi-rs/keyring";

export interface CredentialBundle {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: number;
  readonly scopes: ReadonlyArray<string>;
}

const entry = (profile: string) => new Entry("namera-cli", profile);

export const readCredentials = (profile: string): CredentialBundle | undefined => {
  const value = entry(profile).getPassword();
  return value === null ? undefined : (JSON.parse(value) as CredentialBundle);
};

export const writeCredentials = (profile: string, credentials: CredentialBundle) => {
  entry(profile).setPassword(JSON.stringify(credentials));
};

export const deleteCredentials = (profile: string) => {
  try {
    entry(profile).deletePassword();
  } catch {
    // Keyring backends report a missing credential as an error; logout remains idempotent.
  }
};
