import { open, unlink } from "node:fs/promises";

import { OAuthDeviceAuthorizationStartResponse, OAuthTokenResponse } from "@namera-ai/protocol/dto";

import { cliLockPath } from "./config.js";
import { readCredentials, writeCredentials, type CredentialBundle } from "./credentials.js";
import { cliFailure } from "./error-feedback.js";
import { postOAuthForm } from "./oauth-http.js";

export { OAuthRequestError } from "./oauth-http.js";

const clientId = "namera-cli";
const resourceScopes = [
  "wallet:read",
  "session-key:read",
  "execution:read",
  "execution:execute",
  "signature:create",
  "offline_access",
] as const;

export const startDeviceAuthorization = (
  baseUrl: string,
  metadata: { readonly deviceName: string; readonly cliVersion: string; readonly platform: string },
) =>
  postOAuthForm(
    `${baseUrl}/oauth/device/authorize`,
    new URLSearchParams({
      client_id: clientId,
      scope: resourceScopes.join(" "),
      resource: new URL(baseUrl).origin,
      device_name: metadata.deviceName,
      cli_version: metadata.cliVersion,
      platform: metadata.platform,
    }),
    OAuthDeviceAuthorizationStartResponse,
  );

const toCredentials = (token: typeof OAuthTokenResponse.Type): CredentialBundle => ({
  accessToken: token.access_token,
  refreshToken: token.refresh_token ?? null,
  expiresAt: Date.now() + token.expires_in * 1_000,
  scopes: token.scope.split(/\s+/).filter(Boolean),
});

export const pollDeviceToken = async (baseUrl: string, deviceCode: string) => {
  const token = await postOAuthForm(
    `${baseUrl}/oauth/token`,
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: clientId,
      resource: new URL(baseUrl).origin,
    }),
    OAuthTokenResponse,
  );
  return toCredentials(token);
};

const acquireRefreshLock = async (profile: string) => {
  const path = cliLockPath(profile);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      // Lock acquisition must be sequential so concurrent CLI processes cannot rotate one token.
      // oxlint-disable-next-line no-await-in-loop
      const handle = await open(path, "wx", 0o600);
      return async () => {
        await handle.close();
        await unlink(path).catch(() => undefined);
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw cliFailure("AUTH_BUSY");
};

export const getValidAccessToken = async (profile: string, baseUrl: string) => {
  const release = await acquireRefreshLock(profile);
  try {
    const credentials = readCredentials(profile);
    if (credentials === undefined) throw cliFailure("UNAUTHORIZED");
    if (credentials.expiresAt > Date.now() + 30_000) return credentials.accessToken;
    if (credentials.refreshToken === null) throw cliFailure("UNAUTHORIZED");

    const token = await postOAuthForm(
      `${baseUrl}/oauth/token`,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: clientId,
        resource: new URL(baseUrl).origin,
      }),
      OAuthTokenResponse,
    );
    const refreshed = toCredentials(token);
    writeCredentials(profile, refreshed);
    return refreshed.accessToken;
  } finally {
    await release();
  }
};
