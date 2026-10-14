import { OAuthDeviceAuthorizationStartResponse, OAuthTokenResponse } from "@namera-ai/protocol/dto";

import type { CredentialBundle } from "./credentials.js";
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

export const refreshCredentials = async (baseUrl: string, refreshToken: string) => {
  const token = await postOAuthForm(
    `${baseUrl}/oauth/token`,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      resource: new URL(baseUrl).origin,
    }),
    OAuthTokenResponse,
  );
  return toCredentials(token);
};
