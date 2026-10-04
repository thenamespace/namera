import assert from "node:assert/strict";

import { expect, layer } from "@effect/vitest";
import { Effect, Metric } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { Passkeys } from "@namera-ai/passkeys";
import { waitlistJoins, waitlistStatusChanges } from "@namera-ai/telemetry";

import { SecurityHeadersMiddleware } from "#/middlewares/security-headers";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";

const adminToken = "test-only-waitlist-admin-token-with-32-characters";
const TestLayer = makeTestServerLayer(
  {},
  Passkeys.testLayer,
  makeTestConfigLayer({ ADMIN_TOKEN: adminToken }),
);
const adminClient = handledApi(NameraApi, { headers: { authorization: `Bearer ${adminToken}` } });

const rawRequest = Effect.fnUntraced(function* (
  path: string,
  body: unknown,
  method = "POST",
  token?: string,
) {
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
            ...(token ? { authorization: `Bearer ${token}` } : {}),
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
  it.effect("normalizes email, deduplicates joins, and creates no account or email job", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const before = yield* Metric.value(waitlistJoins);
      const first = yield* rawRequest("/waitlist", { email: "  Person@Example.com " });
      const duplicate = yield* rawRequest("/waitlist", { email: "person@example.com" });
      expect(first.status).toBe(200);
      expect(duplicate.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("no-store");
      const admin = yield* adminClient;
      const result = yield* admin.adminWaitlist.list({ query: {} });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({
        email: "person@example.com",
        status: "pending",
        completedAt: null,
      });
      expect(result.nextCursor).toBeNull();
      const db = yield* Database;
      expect(yield* db.query.user.findMany()).toHaveLength(0);
      expect(yield* db.query.emailJob.findMany()).toHaveLength(0);
      expect(yield* db.query.waitlistEvent.findMany()).toHaveLength(0);
      const after = yield* Metric.value(waitlistJoins);
      expect(after.count - before.count).toBe(1);
    }),
  );

  it.effect("completes and reopens with exactly one event and metric per real change", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* handledApi(NameraApi);
      const email = testEmail("status@example.com");
      expect(yield* client.waitlist.join({ payload: { email } })).toEqual({ accepted: true });
      const admin = yield* adminClient;
      const entry = (yield* admin.adminWaitlist.list({ query: {} })).entries[0];
      assert(entry);
      const metric = Metric.withAttributes(waitlistStatusChanges, { status: "completed" });
      const before = yield* Metric.value(metric);
      const completed = yield* admin.adminWaitlist.setStatus({
        params: { id: entry.id },
        payload: { status: "completed" },
      });
      expect(completed.completedAt).not.toBeNull();
      const repeated = yield* admin.adminWaitlist.setStatus({
        params: { id: entry.id },
        payload: { status: "completed" },
      });
      expect(repeated).toEqual(completed);
      expect(yield* client.waitlist.join({ payload: { email } })).toEqual({ accepted: true });
      expect((yield* admin.adminWaitlist.list({ query: {} })).entries[0]).toEqual(completed);
      const after = yield* Metric.value(metric);
      expect(after.count - before.count).toBe(1);
      const reopened = yield* admin.adminWaitlist.setStatus({
        params: { id: entry.id },
        payload: { status: "pending" },
      });
      expect(reopened.completedAt).toBeNull();
      const events = yield* (yield* Database).query.waitlistEvent.findMany();
      expect(events).toHaveLength(2);
      expect(events.map(({ previousStatus, status }) => [previousStatus, status])).toEqual([
        ["pending", "completed"],
        ["completed", "pending"],
      ]);
    }),
  );

  it.effect("paginates without overlap and filters status and literal email substrings", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* handledApi(NameraApi);
      for (const email of ["a_one@example.com", "another@example.com", "b@example.com"]) {
        yield* client.waitlist.join({ payload: { email: testEmail(email) } });
      }
      const admin = yield* adminClient;
      const first = yield* admin.adminWaitlist.list({ query: { limit: 2 } });
      expect(first.entries).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      assert(first.nextCursor);
      const second = yield* admin.adminWaitlist.list({
        query: { limit: 2, cursor: first.nextCursor },
      });
      expect(second.entries).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect(new Set([...first.entries, ...second.entries].map((entry) => entry.id)).size).toBe(3);
      const filtered = yield* admin.adminWaitlist.list({ query: { search: "_ONE@EXAMPLE.COM" } });
      expect(filtered.entries.map((entry) => entry.email)).toEqual(["a_one@example.com"]);
      assert(filtered.entries[0]);
      yield* admin.adminWaitlist.setStatus({
        params: { id: filtered.entries[0].id },
        payload: { status: "completed" },
      });
      expect(
        (yield* admin.adminWaitlist.list({ query: { status: "completed" } })).entries,
      ).toHaveLength(1);
      expect(
        (yield* admin.adminWaitlist.list({ query: { status: "pending" } })).entries,
      ).toHaveLength(2);
    }),
  );

  it.effect("rejects malformed input and protects admin reads and writes", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      for (const payload of [{}, { email: "bad" }, { email: `${"a".repeat(255)}@example.com` }]) {
        expect((yield* rawRequest("/waitlist", payload)).status).toBe(400);
      }
      const path = "/internal/waitlist/00000000-0000-4000-8000-000000000001";
      expect((yield* rawRequest("/internal/waitlist", undefined, "GET")).status).toBe(401);
      expect((yield* rawRequest(path, { status: "completed" }, "PATCH", "wrong")).status).toBe(401);
      expect((yield* rawRequest(path, { status: "invited" }, "PATCH", adminToken)).status).toBe(
        400,
      );
      expect((yield* rawRequest(path, { status: "completed" }, "PATCH", adminToken)).status).toBe(
        404,
      );
      for (const query of ["limit=0", "limit=101", "cursor=bad", "status=invited"]) {
        expect(
          (yield* rawRequest(`/internal/waitlist?${query}`, undefined, "GET", adminToken)).status,
        ).toBe(400);
      }
      expect(yield* (yield* Database).query.waitlist.findMany()).toHaveLength(0);
    }),
  );

  it.effect("handles competing joins and repeated completion atomically", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const clients = yield* Effect.all([handledApi(NameraApi), handledApi(NameraApi)]);
      const payload = { email: testEmail("race@example.com") };
      const results = yield* Effect.all(
        clients.map((client) => client.waitlist.join({ payload })),
        { concurrency: "unbounded" },
      );
      expect(results).toEqual([{ accepted: true }, { accepted: true }]);
      const admin = yield* adminClient;
      const entries = (yield* admin.adminWaitlist.list({ query: {} })).entries;
      expect(entries).toHaveLength(1);
      const entry = entries[0];
      assert(entry);
      yield* Effect.all(
        [1, 2].map(() =>
          admin.adminWaitlist.setStatus({
            params: { id: entry.id },
            payload: { status: "completed" },
          }),
        ),
        { concurrency: "unbounded" },
      );
      expect(yield* (yield* Database).query.waitlistEvent.findMany()).toHaveLength(1);
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
