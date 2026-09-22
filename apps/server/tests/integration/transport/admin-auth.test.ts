import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";
import { HttpServer } from "effect/unstable/http";
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AdminAuthorization, CurrentAdmin } from "@namera-ai/api";

import { AdminAuthorizationLive } from "#/middlewares/admin";
import { RateLimiterLive } from "#/rate-limit";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";

const adminToken = "test-only-admin-token-with-at-least-32-characters";

class AdminProbe extends HttpApiGroup.make("adminProbe")
  .add(HttpApiEndpoint.get("actor", "/internal/probe", { success: Schema.String }))
  .middleware(AdminAuthorization) {}

class ProbeApi extends HttpApi.make("adminProbeApi").add(AdminProbe) {}

const ProbeHandlers = HttpApiBuilder.group(ProbeApi, "adminProbe", (handlers) =>
  handlers.handle("actor", () =>
    Effect.gen(function* () {
      const admin = yield* CurrentAdmin;
      return `${admin.type}:${admin.credential}`;
    }),
  ),
);

const probeLayer = (config: Record<string, string>) => {
  const authorization = AdminAuthorizationLive.pipe(
    Layer.provide(RateLimiterLive),
    Layer.provide(makeTestConfigLayer(config)),
  );
  return Layer.mergeAll(
    ProbeHandlers.pipe(Layer.provide(authorization)),
    authorization,
    HttpServer.layerServices,
  );
};

layer(probeLayer({ ADMIN_TOKEN: adminToken }))("admin authorization", (it) => {
  // A valid bearer is no longer charged against a global hourly ceiling: the
  // operator portal is a browser client and would otherwise lock itself out.
  // Per-operation budgets live in the handlers instead.
  it.effect("does not exhaust a global ceiling on authenticated reads", () =>
    Effect.gen(function* () {
      yield* TestClock.adjust("2 hours");
      for (let operation = 0; operation < 40; operation += 1) {
        const client = yield* handledApi(ProbeApi, {
          headers: { authorization: `Bearer ${adminToken}` },
          remoteAddress: `192.0.2.${operation + 1}`,
        });
        expect((yield* client.adminProbe.actor({ responseMode: "response-only" })).status).toBe(
          200,
        );
      }
      yield* TestClock.adjust("2 hours");
    }),
  );
  it.effect("provides the admin context only for a valid bearer credential", () =>
    Effect.gen(function* () {
      const client = yield* handledApi(ProbeApi, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(yield* client.adminProbe.actor()).toBe("admin:shared-token");
      for (const headers of [
        {},
        { authorization: "Bearer incorrect" },
        { authorization: `Basic ${adminToken}` },
        { "x-api-key": adminToken },
        { cookie: `auth-token=${adminToken}` },
      ]) {
        const rejected = yield* handledApi(ProbeApi, { headers });
        expect((yield* rejected.adminProbe.actor({ responseMode: "response-only" })).status).toBe(
          401,
        );
      }
    }),
  );

  it.effect("rate limits incorrect credentials before allowing more attempts", () =>
    Effect.gen(function* () {
      const client = yield* handledApi(ProbeApi, {
        headers: { authorization: "Bearer incorrect" },
        remoteAddress: "192.0.2.200",
      });
      for (let attempt = 0; attempt < 60; attempt += 1) {
        expect((yield* client.adminProbe.actor({ responseMode: "response-only" })).status).toBe(
          401,
        );
      }
      expect((yield* client.adminProbe.actor({ responseMode: "response-only" })).status).toBe(429);
      yield* TestClock.adjust("1 minute");
      expect((yield* client.adminProbe.actor({ responseMode: "response-only" })).status).toBe(401);
    }),
  );
});

for (const [name, config] of [
  ["missing token", {}],
  ["short token", { ADMIN_TOKEN: "short" }],
  ["legacy token only", { INVITE_ADMIN_TOKEN: adminToken }],
] as const) {
  layer(probeLayer(config))(`admin disabled: ${name}`, (it) => {
    it.effect("fails closed", () =>
      Effect.gen(function* () {
        const client = yield* handledApi(ProbeApi, {
          headers: {
            authorization: `Bearer ${"ADMIN_TOKEN" in config ? config.ADMIN_TOKEN : adminToken}`,
          },
        });
        expect((yield* client.adminProbe.actor({ responseMode: "response-only" })).status).toBe(
          401,
        );
      }),
    );
  });
}
