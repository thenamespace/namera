import { Effect, Option } from "effect";

import { HttpServerRequest } from "effect/unstable/http";

import { AuthConfig } from "@namera-ai/auth";

export const getHttpRequestMetadata = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const authConfig = yield* AuthConfig.AuthConfig;

  const userAgent = request.headers["user-agent"] ?? null;

  const ipAddress = authConfig.advanced.ipAddress.disableIpTracking
    ? null
    : (authConfig.advanced.ipAddress.ipAddressHeaders
        .map((header) => request.headers[header]?.split(",")[0]?.trim())
        .find((value) => value && value.length > 0) ??
      Option.getOrNull(request.remoteAddress));

  return {
    ipAddress,
    userAgent,
  };
});
