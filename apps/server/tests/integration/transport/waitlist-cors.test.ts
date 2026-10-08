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
  HttpRouter.add("GET", "/internal/waitlist", HttpServerResponse.empty()),
  HttpRouter.add("POST", "/auth/platform-invitations/accept", HttpServerResponse.empty()),
  HttpRouter.add("GET", "/wallets", HttpServerResponse.empty()),
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
        ["/waitlist", "OPTIONS", "https://www.example.com", true],
        ["/waitlist", "POST", "https://evil.example.com", false],
        ["/internal/waitlist", "GET", "https://www.example.com", false],
        ["/wallets", "GET", "https://www.example.com", false],
        ["/wallets", "OPTIONS", "https://www.example.com", false],
        ["/wallets", "GET", "https://app.example.com", true],
        ["/internal/waitlist", "GET", "https://admin.example.com", true],
        ["/internal/waitlist", "OPTIONS", "https://admin.example.com", true],
        ["/auth/platform-invitations/accept", "POST", "https://admin.example.com", true],
        ["/auth/platform-invitations/accept", "POST", "https://evil.example.com", false],
        ["/wallets", "GET", "https://admin.example.com", false],
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
        if (expected && origin === "https://admin.example.com")
          expect(response?.headers["access-control-allow-credentials"]).toBe("true");
        if (path === "/waitlist")
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
      expect(httpRouteTemplate("/internal/waitlist/00000000-0000-4000-8000-000000000001")).toBe(
        "/internal/waitlist/:id",
      );
    }),
  );
});
