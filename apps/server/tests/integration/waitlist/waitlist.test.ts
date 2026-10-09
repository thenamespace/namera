import { expect, layer } from "@effect/vitest";
import { Effect, Exit, Metric } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { EmailJobs, TestEmails } from "@namera-ai/emails";
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
          ["PATCH", "/internal/waitlist/00000000-0000-4000-8000-000000000001"],
          ["GET", "/internal/users"],
        ] as const) {
          expect((yield* rawRequest(path, {}, method, token)).status).toBe(404);
        }
      }
    }),
  );

  it.effect("normalizes email and queues one confirmation without creating an account", () =>
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
      const queued = yield* db.query.emailJob.findMany();
      expect(queued).toHaveLength(1);
      const confirmation = queued[0];
      if (!confirmation) return yield* Effect.die("Missing confirmation email job");
      expect(confirmation).toMatchObject({
        type: "waitlist-confirmed",
        status: "pending",
        idempotencyKey: `waitlist-confirmed:${entries[0]?.id}`,
      });
      expect(confirmation.expiresAt.getTime() - confirmation.availableAt.getTime()).toBe(
        86_400_000,
      );
      const provider = yield* TestEmails;
      expect(yield* provider.sent).toHaveLength(0);
      expect(yield* (yield* EmailJobs).processOnce).toBe(1);
      expect(yield* provider.sent).toMatchObject([
        { type: "waitlist-confirmed", to: "person@example.com", variables: {} },
      ]);
      expect(yield* db.query.waitlistEvent.findMany()).toHaveLength(0);
      const after = yield* Metric.value(waitlistJoins);
      expect(after.count - before.count).toBe(1);
    }),
  );

  it.effect("rolls back the join on enqueue failure and allows a successful retry", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const db = yield* Database;
      const client = yield* handledApi(NameraApi);
      const payload = { email: testEmail("enqueue-failure@example.com") };
      const before = yield* Metric.value(waitlistJoins);
      yield* db.execute(
        "ALTER TABLE jobs.email_jobs ADD CONSTRAINT test_waitlist_confirmation_failure CHECK (type <> 'waitlist-confirmed')",
      );
      const result = yield* client.waitlist
        .join({ payload })
        .pipe(
          Effect.exit,
          Effect.ensuring(
            db
              .execute(
                "ALTER TABLE jobs.email_jobs DROP CONSTRAINT test_waitlist_confirmation_failure",
              )
              .pipe(Effect.orDie),
          ),
        );
      expect(Exit.isFailure(result)).toBe(true);
      expect(yield* db.query.waitlist.findMany()).toHaveLength(0);
      expect(yield* db.query.emailJob.findMany()).toHaveLength(0);
      expect((yield* Metric.value(waitlistJoins)).count).toBe(before.count);
      expect(yield* client.waitlist.join({ payload })).toEqual({ accepted: true });
      expect(yield* db.query.waitlist.findMany()).toHaveLength(1);
      expect(yield* db.query.emailJob.findMany()).toHaveLength(1);
    }),
  );

  it.effect("retries provider failures without another confirmation on repeat joins", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* handledApi(NameraApi);
      const payload = { email: testEmail("delivery-retry@example.com") };
      yield* client.waitlist.join({ payload });
      const jobs = yield* EmailJobs;
      const provider = yield* TestEmails;
      yield* provider.failNext();
      expect(yield* jobs.processOnce).toBe(1);
      expect(yield* provider.sent).toHaveLength(0);
      yield* client.waitlist.join({ payload });
      yield* TestClock.adjust("5 minutes");
      expect(yield* jobs.processOnce).toBe(1);
      yield* client.waitlist.join({ payload });
      expect(yield* jobs.processOnce).toBe(0);
      expect(yield* provider.sent).toHaveLength(1);
      expect(yield* (yield* Database).query.emailJob.findMany()).toMatchObject([
        { type: "waitlist-confirmed", status: "sent", attempts: 2 },
      ]);
    }),
  );

  it.effect("rejects malformed public input", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      for (const payload of [{}, { email: "bad" }, { email: `${"a".repeat(255)}@example.com` }]) {
        expect((yield* rawRequest("/waitlist", payload)).status).toBe(400);
      }
      expect(yield* (yield* Database).query.waitlist.findMany()).toHaveLength(0);
      expect(yield* (yield* Database).query.emailJob.findMany()).toHaveLength(0);
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
      expect(yield* (yield* Database).query.emailJob.findMany()).toHaveLength(1);
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
