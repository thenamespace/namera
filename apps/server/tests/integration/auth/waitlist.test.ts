import { expect, layer } from "@effect/vitest";
import { Effect, Metric } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { Passkeys } from "@namera-ai/passkeys";
import { waitlistJoins } from "@namera-ai/telemetry";

import { SecurityHeadersMiddleware } from "#/middlewares/security-headers";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const adminToken = "use-platform-session";
const TestLayer = makeTestServerLayer({}, Passkeys.testLayer, makeTestConfigLayer());

const rawRequest = Effect.fnUntraced(function* (
  path: string,
  body: unknown,
  method = "POST",
  token?: string,
) {
  const adminHeaders = token === adminToken ? (yield* platformIdentity()).headers : {};
  const handler = yield* HttpRouter.toHttpEffect(HttpApiBuilder.layer(NameraApi));
  let response: HttpServerResponse.HttpServerResponse | undefined;
  yield* HttpEffect.toHandled(SecurityHeadersMiddleware(handler), (_request, result) =>
    Effect.sync(() => {
      response = result;
    }),
  ).pipe(
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(
        new Request(`http://api.test${path}`, {
          method,
          headers: {
            "content-type": "application/json",
            ...(token && token !== adminToken
              ? { authorization: `Bearer ${token}` }
              : adminHeaders),
          },
          ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
        }),
      ),
    ),
    Effect.exit,
  );
  if (!response) return yield* Effect.die("Missing HTTP response");
  return response;
});

layer(TestLayer)("waitlist", (it) => {
  it.effect("returns 404 for retired management routes, even with an owner session", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      for (const token of [undefined, adminToken]) {
        for (const [method, path] of [
          ["GET", "/internal/invites"],
          ["POST", "/internal/invites"],
          ["DELETE", "/internal/invites/00000000-0000-4000-8000-000000000001"],
          ["GET", "/internal/waitlist"],
          ["PATCH", "/internal/waitlist/00000000-0000-4000-8000-000000000001"],
          ["GET", "/internal/users"],
        ] as const) {
          expect((yield* rawRequest(path, {}, method, token)).status).toBe(404);
        }
      }
    }),
  );

  it.effect("normalizes email, deduplicates joins, and creates no account or email job", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const before = yield* Metric.value(waitlistJoins);
      const first = yield* rawRequest("/waitlist", { email: "  Person@Example.com " });
      const duplicate = yield* rawRequest("/waitlist", { email: "person@example.com" });
      expect(first.status).toBe(200);
      expect(duplicate.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("no-store");
      const entries = yield* (yield* Database).query.waitlist.findMany();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        email: "person@example.com",
        status: "pending",
        completedAt: null,
      });
      const db = yield* Database;
      expect(yield* db.query.user.findMany()).toHaveLength(0);
      expect(yield* db.query.emailJob.findMany()).toHaveLength(0);
      expect(yield* db.query.waitlistEvent.findMany()).toHaveLength(0);
      const after = yield* Metric.value(waitlistJoins);
      expect(after.count - before.count).toBe(1);
    }),
  );

  it.effect("rejects malformed public input", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      for (const payload of [{}, { email: "bad" }, { email: `${"a".repeat(255)}@example.com` }]) {
        expect((yield* rawRequest("/waitlist", payload)).status).toBe(400);
      }
      expect(yield* (yield* Database).query.waitlist.findMany()).toHaveLength(0);
    }),
  );

  it.effect("handles competing joins atomically", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const clients = yield* Effect.all([handledApi(NameraApi), handledApi(NameraApi)]);
      const payload = { email: testEmail("race@example.com") };
      const results = yield* Effect.all(
        clients.map((client) => client.waitlist.join({ payload })),
        { concurrency: "unbounded" },
      );
      expect(results).toEqual([{ accepted: true }, { accepted: true }]);
      expect(yield* (yield* Database).query.waitlist.findMany()).toHaveLength(1);
      expect(yield* (yield* Database).query.waitlistEvent.findMany()).toHaveLength(0);
      expect(yield* (yield* Repository).auth.user.findByEmail(payload.email)).toBeUndefined();
    }),
  );

  it.effect("limits public submissions per address", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* handledApi(NameraApi, { remoteAddress: "192.0.2.240" });
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = yield* client.waitlist.join({
          payload: { email: testEmail("limit@example.com") },
          responseMode: "response-only",
        });
        expect(response.status).toBe(attempt < 5 ? 200 : 429);
      }
    }),
  );
});
