import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { SecurityHeadersMiddleware } from "../../../src/middlewares/security-headers.js";

for (const status of [200, 303, 401, 500]) {
  it.effect(`preserves status ${status} and existing headers while applying API protections`, () =>
    Effect.gen(function* () {
      let observed: HttpServerResponse.HttpServerResponse | undefined;
      const handler = SecurityHeadersMiddleware(
        Effect.succeed(
          HttpServerResponse.empty({
            status,
            headers: { "cache-control": "no-store", location: "https://example.com/callback" },
          }),
        ),
      );
      yield* HttpEffect.toHandled(handler, (_request, response) =>
        Effect.sync(() => {
          observed = response;
        }),
      ).pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(new Request("https://api.example.com/oauth/authorize")),
        ),
      );

      expect(observed?.status).toBe(status);
      expect(observed?.headers).toMatchObject({
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "no-referrer",
        "cache-control": "no-store",
        location: "https://example.com/callback",
      });
    }),
  );
}

it.effect("applies protections when routing fails before producing a response", () =>
  Effect.gen(function* () {
    let observed: HttpServerResponse.HttpServerResponse | undefined;
    yield* HttpEffect.toHandled(
      SecurityHeadersMiddleware(Effect.die("transport regression fixture")),
      (_request, response) =>
        Effect.sync(() => {
          observed = response;
        }),
    ).pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(new Request("https://api.example.com/failure")),
      ),
      Effect.exit,
    );
    expect(observed?.status).toBe(500);
    expect(observed?.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    });
  }),
);
