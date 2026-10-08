import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
  HttpEffect,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

import { httpRouteTemplate } from "@namera-ai/telemetry";

import { CorsMiddleware } from "#/middlewares/cors";

import { makeTestConfigLayer } from "../../fixtures/layers/config.js";

const routes = Layer.mergeAll(
  HttpRouter.add("POST", "/waitlist", HttpServerResponse.empty()),
  HttpRouter.add("POST", "/t/traces/v1", HttpServerResponse.empty()),
  HttpRouter.add("GET", "/internal/me", HttpServerResponse.empty()),
  HttpRouter.add("POST", "/auth/platform-invitations/accept", HttpServerResponse.empty()),
  HttpRouter.add("GET", "/wallets", HttpServerResponse.empty()),
  HttpRouter.add("POST", "/auth/google/start", HttpServerResponse.empty()),
  HttpRouter.add("POST", "/auth/magic-link/request", HttpServerResponse.empty()),
  HttpRouter.add("POST", "/auth/magic-link/verify", HttpServerResponse.empty()),
  CorsMiddleware.pipe(
    Layer.provide(
      makeTestConfigLayer({
        SERVER_CORS_ORIGIN: "https://app.example.com",
        WAITLIST_CORS_ORIGIN: "https://www.example.com",
        ADMIN_CORS_ORIGIN: "https://admin.example.com",
      }),
    ),
  ),
);

layer(HttpServer.layerServices)("waitlist CORS and telemetry", (it) => {
  it.effect("allows only public submissions from the landing-page origin", () =>
    Effect.gen(function* () {
      const handler = yield* HttpRouter.toHttpEffect(routes);
      for (const [path, method, origin, expected] of [
        ["/waitlist", "POST", "https://www.example.com", true],
        ["/t/traces/v1", "OPTIONS", "https://admin.example.com", true],
        ["/t/traces/v1", "POST", "https://admin.example.com", true],
        ["/t/traces/v1", "POST", "https://app.example.com", true],
        ["/t/traces/v1", "POST", "https://www.example.com", false],
        ["/t/traces/v1", "POST", "https://evil.example.com", false],
        ["/waitlist", "OPTIONS", "https://www.example.com", true],
        ["/waitlist", "POST", "https://evil.example.com", false],
        ["/internal/me", "GET", "https://www.example.com", false],
        ["/wallets", "GET", "https://www.example.com", false],
        ["/wallets", "OPTIONS", "https://www.example.com", false],
        ["/wallets", "GET", "https://app.example.com", true],
        ["/internal/me", "GET", "https://admin.example.com", true],
        ["/internal/me", "OPTIONS", "https://admin.example.com", true],
        ["/auth/platform-invitations/accept", "POST", "https://admin.example.com", true],
        ["/auth/platform-invitations/accept", "POST", "https://evil.example.com", false],
        ["/wallets", "GET", "https://admin.example.com", false],
        ["/auth/google/start", "OPTIONS", "https://admin.example.com", true],
        ["/auth/magic-link/request", "POST", "https://admin.example.com", true],
        ["/auth/magic-link/verify", "POST", "https://admin.example.com", true],
        ["/auth/google/start", "POST", "https://app.example.com", true],
        ["/auth/google/start", "POST", "https://evil.example.com", false],
      ] as const) {
        let response: HttpServerResponse.HttpServerResponse | undefined;
        yield* HttpEffect.toHandled(handler, (_request, result) =>
          Effect.sync(() => {
            response = result;
          }),
        ).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(
              new Request(`https://api.example.com${path}`, {
                method,
                headers: {
                  origin,
                  "access-control-request-method": "POST",
                  "access-control-request-headers": "content-type",
                },
              }),
            ),
          ),
        );
        if (expected) expect(response?.headers["access-control-allow-origin"]).toBe(origin);
        else expect(response?.headers["access-control-allow-origin"]).not.toBe(origin);
        if (expected && origin === "https://admin.example.com" && !path.startsWith("/t/"))
          expect(response?.headers["access-control-allow-credentials"]).toBe("true");
        if (path === "/waitlist" || path.startsWith("/t/"))
          expect(response?.headers["access-control-allow-credentials"]).toBeUndefined();
        if (path === "/waitlist" && method === "OPTIONS") {
          expect(response?.headers["access-control-allow-methods"]).toBe("POST, OPTIONS");
        }
      }
    }),
  );

  it.effect("never includes entry IDs or email searches in route metric labels", () =>
    Effect.sync(() => {
      expect(httpRouteTemplate("/waitlist")).toBe("/waitlist");
      expect(httpRouteTemplate("/internal/waitlist?search=person@example.com")).toBe(
        "/internal/waitlist",
      );
      expect(
        httpRouteTemplate("/internal/waitlist/00000000-0000-4000-8000-000000000001/accept"),
      ).toBe("/internal/waitlist/:id/accept");
      expect(httpRouteTemplate("/internal/waitlist/00000000-0000-4000-8000-000000000001")).toBe(
        "/*",
      );
    }),
  );
});
