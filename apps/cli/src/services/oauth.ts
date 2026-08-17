import { open, unlink } from "node:fs/promises";

import { cliLockPath } from "./config.js";
import { readCredentials, writeCredentials, type CredentialBundle } from "./credentials.js";

const clientId = "namera-cli";
const resourceScopes = [
  "wallet:read",
  "session-key:read",
  "execution:read",
  "execution:execute",
  "signature:create",
  "offline_access",
] as const;

interface DeviceAuthorizationResponse {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly verification_uri_complete: string;
  readonly expires_in: number;
  readonly interval: number;
}

interface TokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly scope: string;
}

export class OAuthRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const postForm = async <A>(url: string, body: URLSearchParams): Promise<A> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new OAuthRequestError(
      typeof data.error === "string" ? data.error : "oauth_error",
      typeof data.error_description === "string" ? data.error_description : "OAuth request failed",
    );
  }
  return data as A;
};

export const startDeviceAuthorization = (
  baseUrl: string,
  metadata: { readonly deviceName: string; readonly cliVersion: string; readonly platform: string },
) =>
  postForm<DeviceAuthorizationResponse>(
    `${baseUrl}/oauth/device/authorize`,
    new URLSearchParams({
      client_id: clientId,
      scope: resourceScopes.join(" "),
      resource: new URL(baseUrl).origin,
      device_name: metadata.deviceName,
      cli_version: metadata.cliVersion,
      platform: metadata.platform,
    }),
  );

const toCredentials = (token: TokenResponse): CredentialBundle => ({
  accessToken: token.access_token,
  refreshToken: token.refresh_token ?? null,
  expiresAt: Date.now() + token.expires_in * 1_000,
  scopes: token.scope.split(/\s+/).filter(Boolean),
});

export const pollDeviceToken = async (baseUrl: string, deviceCode: string) => {
  const token = await postForm<TokenResponse>(
    `${baseUrl}/oauth/token`,
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: clientId,
      resource: new URL(baseUrl).origin,
    }),
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
  throw new Error("Timed out waiting for another Namera command to refresh credentials.");
};

export const getValidAccessToken = async (profile: string, baseUrl: string) => {
  const release = await acquireRefreshLock(profile);
  try {
    const credentials = readCredentials(profile);
    if (credentials === undefined) throw new Error(`Profile "${profile}" is not logged in.`);
    if (credentials.expiresAt > Date.now() + 30_000) return credentials.accessToken;
    if (credentials.refreshToken === null)
      throw new Error("The CLI session expired. Run namera login.");

    const token = await postForm<TokenResponse>(
      `${baseUrl}/oauth/token`,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: clientId,
        resource: new URL(baseUrl).origin,
      }),
    );
    const refreshed = toCredentials(token);
    writeCredentials(profile, refreshed);
    return refreshed.accessToken;
  } finally {
    await release();
  }
};
