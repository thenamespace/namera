import { Predicate } from "effect";
import { HttpServerResponse, type HttpServerRequest } from "effect/http";

import type { OAuthTokenResult } from "@namera-ai/application";

export const noStoreHeaders = {
  "cache-control": "no-store",
  pragma: "no-cache",
} as const;

export const firstParameter = (value: string | ReadonlyArray<string> | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const hasMediaType = (request: HttpServerRequest.HttpServerRequest, expected: string) =>
  request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() === expected;

export const readUniqueFormParameters = (
  parameters: Iterable<readonly [string, string]>,
  supportedNames: ReadonlySet<string>,
) => {
  const form: Record<string, string> = {};
  const seen = new Set<string>();
  for (const [name, value] of parameters) {
    if (seen.has(name)) return undefined;
    seen.add(name);
    if (supportedNames.has(name)) form[name] = value;
  }
  return form;
};

export const oauthError = (error: string, description: string, status = 400) =>
  HttpServerResponse.jsonUnsafe(
    { error, error_description: description },
    { status, headers: noStoreHeaders },
  );

export const rateLimited = (failure: unknown) =>
  Predicate.isTagged(failure, "RateLimitExceeded")
    ? oauthError("temporarily_unavailable", "Too many requests", 429)
    : HttpServerResponse.empty({ status: 500 });

export const tokenResponse = (result: OAuthTokenResult) =>
  HttpServerResponse.jsonUnsafe(
    {
      token_type: "Bearer",
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      ...(result.refreshToken === undefined ? {} : { refresh_token: result.refreshToken }),
      scope: result.scopes.join(" "),
    },
    { headers: noStoreHeaders },
  );
