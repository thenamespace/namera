import { Effect } from "effect";
import { HttpEffect, HttpMiddleware, HttpServerResponse } from "effect/unstable/http";

// These apply to the API origin, including OAuth redirects and error responses.
// Dashboard document CSP and WebAuthn permissions belong to its separate origin.
const headers = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
} as const;

export const SecurityHeadersMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    yield* HttpEffect.appendPreResponseHandler((_request, response) =>
      Effect.succeed(
        HttpServerResponse.setHeaders(response, {
          ...headers,
          // Public OAuth discovery opts into caching; errors never inherit it.
          "cache-control":
            response.status < 400 ? (response.headers["cache-control"] ?? "no-store") : "no-store",
        }),
      ),
    );
    return yield* httpEffect;
  }),
);
