import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import {
  HttpEffect,
  HttpRouter,
  HttpServerRequest,
  type HttpServerResponse,
} from "effect/unstable/http";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import { Authorization, NameraApi } from "@namera-ai/api";

import { SecurityHeadersMiddleware } from "../../../src/middlewares/security-headers.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

// Raw OAuth protocol routes have separate protocol/PKCE tests; this is the typed API surface.
const publicEndpoints = new Set([
  "health.health",
  "ens.isNameAvailable",
  "magicLink.request",
  "magicLink.verify",
]);
const protectedEndpoints: Array<{ name: string; method: string; path: string }> = [];
HttpApi.reflect(NameraApi, {
  onGroup: () => {},
  onEndpoint: ({ group, endpoint, middleware }) => {
    const name = `${group.identifier}.${endpoint.identifier}`;
    if (publicEndpoints.has(name)) return;
    protectedEndpoints.push({ name, method: endpoint.method, path: endpoint.path });
    if (![...middleware].some((service) => service.key === Authorization.key))
      throw new Error(`Protected endpoint lacks authentication: ${name}`);
  },
});

layer(TestServerLayer)("typed API authentication boundary", (it) => {
  it.effect(
    "rejects every protected endpoint without credentials before decoding its payload",
    () =>
      Effect.gen(function* () {
        const handler = yield* HttpRouter.toHttpEffect(HttpApiBuilder.layer(NameraApi));
        expect(protectedEndpoints.length).toBeGreaterThan(0);
        for (const endpoint of protectedEndpoints) {
          const path = endpoint.path.replace(/:[^/]+/g, "00000000-0000-4000-8000-000000000001");
          let response: HttpServerResponse.HttpServerResponse | undefined;
          yield* HttpEffect.toHandled(SecurityHeadersMiddleware(handler), (_request, result) =>
            Effect.sync(() => {
              response = result;
            }),
          ).pipe(
            Effect.provideService(
              HttpServerRequest.HttpServerRequest,
              HttpServerRequest.fromWeb(
                new Request(`http://api.test${path}`, { method: endpoint.method }),
              ),
            ),
          );
          expect(response?.status, endpoint.name).toBe(401);
          expect(response?.headers["cache-control"], endpoint.name).toBe("no-store");
        }
      }),
  );
});
