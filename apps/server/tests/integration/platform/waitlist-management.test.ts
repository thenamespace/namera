import { expect, layer } from "@effect/vitest";
import { Effect, Exit, Metric, Schema } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Database, Repository } from "@namera-ai/database";
import { EmailJobs, TestEmails } from "@namera-ai/emails";
import { ListWaitlistRequest } from "@namera-ai/protocol/dto";
import { waitlistAcceptances } from "@namera-ai/telemetry";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const reset = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
});

layer(TestServerLayer)("waitlist management", (it) => {
  it.effect("rolls back completion, issuance and audit when the outbox cannot persist", () =>
    Effect.gen(function* () {
      yield* reset;
      const owner = yield* platformIdentity();
      const db = yield* Database;
      const entry = yield* (yield* Repository).auth.waitlist.join(
        testEmail("rollback@example.com"),
      );
      if (!entry) return yield* Effect.die("Missing entry");
      const before = yield* Metric.value(waitlistAcceptances);
      // Inject a storage failure in this disposable test database, not a mocked workflow.
      yield* db.execute(
        "ALTER TABLE jobs.email_jobs ADD CONSTRAINT test_waitlist_outbox_failure CHECK (type <> 'waitlist-accepted')",
      );
      const response = yield* owner.client.adminWaitlist
        .accept({ params: { id: entry.id }, responseMode: "response-only" })
        .pipe(
          Effect.exit,
          Effect.ensuring(
            db
              .execute("ALTER TABLE jobs.email_jobs DROP CONSTRAINT test_waitlist_outbox_failure")
              .pipe(Effect.orDie),
          ),
        );
      expect(Exit.isFailure(response)).toBe(true);
      expect((yield* db.query.waitlist.findMany())[0]).toMatchObject({
        status: "pending",
        completedAt: null,
      });
      expect(yield* db.query.betaInvite.findMany()).toHaveLength(0);
      expect(yield* db.query.betaInviteEvent.findMany()).toHaveLength(0);
      expect(yield* db.query.waitlistEvent.findMany()).toHaveLength(0);
      expect(yield* db.query.emailJob.findMany()).toHaveLength(0);
      expect(
        (yield* db.query.platformEvent.findMany()).filter(
          (event) =>
            event.data.type === "waitlist.accepted" || event.data.type === "beta-invite.created",
        ),
      ).toHaveLength(0);
      expect((yield* Metric.value(waitlistAcceptances)).count).toBe(before.count);
      expect(yield* owner.client.adminWaitlist.accept({ params: { id: entry.id } })).toEqual({
        accepted: true,
      });
    }),
  );
  it.effect(
    "accepts once under competing requests, queues a bound invite, and audits the transition",
    () =>
      Effect.gen(function* () {
        yield* reset;
        const owner = yield* platformIdentity();
        const repository = yield* Repository;
        const email = testEmail("recipient@example.com");
        const entry = yield* repository.auth.waitlist.join(email);
        if (!entry) return yield* Effect.die("Missing entry");
        const before = yield* Metric.value(waitlistAcceptances);
        const results = yield* Effect.all(
          [0, 1, 2].map(() => owner.client.adminWaitlist.accept({ params: { id: entry.id } })),
          { concurrency: "unbounded" },
        );
        expect(results.filter((result) => result.accepted)).toHaveLength(1);
        expect((yield* Metric.value(waitlistAcceptances)).count - before.count).toBe(1);
        const db = yield* Database;
        const entries = yield* db.query.waitlist.findMany();
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ status: "completed", email });
        expect(entries[0]?.completedAt).not.toBeNull();
        const invites = yield* db.query.betaInvite.findMany();
        expect(invites).toHaveLength(1);
        expect(invites[0]?.email).toBe(email);
        expect(yield* db.query.emailJob.findMany()).toHaveLength(1);
        expect(yield* db.query.waitlistEvent.findMany()).toHaveLength(1);
        expect(yield* db.query.betaInviteEvent.findMany()).toHaveLength(1);
        expect(
          (yield* db.query.platformEvent.findMany()).filter(
            (event) => event.data.type === "waitlist.accepted",
          ),
        ).toMatchObject([
          {
            actorMemberId: owner.member.id,
            data: { waitlistId: entry.id, inviteId: invites[0]?.id },
          },
        ]);
        expect(yield* repository.auth.user.findByEmail(email)).toBeUndefined();
        const jobs = yield* EmailJobs;
        const emailProvider = yield* TestEmails;
        yield* emailProvider.failNext();
        expect(yield* jobs.processOnce).toBe(1);
        expect(yield* emailProvider.sent).toHaveLength(0);
        expect(yield* owner.client.adminWaitlist.accept({ params: { id: entry.id } })).toEqual({
          accepted: false,
        });
        yield* TestClock.adjust("5 minutes");
        expect(yield* jobs.processOnce).toBe(1);
        expect(yield* jobs.processOnce).toBe(0);
        const sent = yield* (yield* TestEmails).sent;
        expect(sent).toHaveLength(1);
        const mail = sent[0];
        if (!mail || mail.type !== "waitlist-accepted")
          return yield* Effect.die("Missing acceptance email");
        expect(mail.to).toBe(email);
        const url = new URL(mail.variables.invitationUrl);
        expect(url.origin).toBe("http://dashboard.test");
        expect(url.pathname).toBe("/auth");
        expect(url.searchParams.get("invite")).toBe(mail.variables.inviteCode);
        expect(invites[0]?.codeHmac).toBe(
          yield* (yield* CryptoService).hmac({
            purpose: cryptoPurpose.betaInvite,
            value: mail.variables.inviteCode,
          }),
        );
        expect(mail.variables.expiresAt).toBe(invites[0]?.expiresAt.toISOString());
        expect(yield* repository.auth.waitlist.join(email)).toBeUndefined();
        expect(
          (yield* owner.client.adminWaitlist.list({ query: { status: "completed" } })).entries,
        ).toHaveLength(1);
        expect(
          yield* owner.client.adminWaitlist.accept({
            params: { id: "00000000-0000-4000-8000-000000000001" },
          }),
        ).toEqual({ accepted: false });
      }),
  );

  it.effect(
    "restricts acceptance to owners and operators and enforces session and origin checks",
    () =>
      Effect.gen(function* () {
        yield* reset;
        const owner = yield* platformIdentity();
        const operator = yield* platformIdentity("operator@example.com", "operator");
        const viewer = yield* platformIdentity("viewer@example.com", "viewer");
        const repository = yield* Repository;
        const entry = yield* repository.auth.waitlist.join(testEmail("waiting@example.com"));
        if (!entry) return yield* Effect.die("Missing entry");
        for (const identity of [owner, operator, viewer]) {
          expect((yield* identity.client.adminWaitlist.list({ query: {} })).entries).toHaveLength(
            1,
          );
        }
        expect(
          (yield* viewer.client.adminWaitlist.accept({
            params: { id: entry.id },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        const anonymous = yield* handledApi(NameraApi);
        expect(
          (yield* anonymous.adminWaitlist.list({ query: {}, responseMode: "response-only" }))
            .status,
        ).toBe(401);
        expect(
          (yield* anonymous.adminWaitlist.accept({
            params: { id: entry.id },
            responseMode: "response-only",
          })).status,
        ).toBe(401);
        for (const origin of [undefined, "https://evil.test"]) {
          const client = yield* handledApi(NameraApi, {
            headers: { cookie: owner.headers.cookie, ...(origin ? { origin } : {}) },
          });
          expect(
            (yield* client.adminWaitlist.accept({
              params: { id: entry.id },
              responseMode: "response-only",
            })).status,
          ).toBe(403);
        }
        expect(yield* (yield* Database).query.emailJob.findMany()).toHaveLength(0);
        expect(yield* operator.client.adminWaitlist.accept({ params: { id: entry.id } })).toEqual({
          accepted: true,
        });
        yield* owner.client.platform.changeStatus({
          params: { id: operator.member.id },
          payload: { status: "suspended" },
        });
        expect(
          (yield* operator.client.adminWaitlist.list({ query: {}, responseMode: "response-only" }))
            .status,
        ).toBe(403);
      }),
  );

  it.effect(
    "filters email literally, filters status, and paginates 25 entries without overlap",
    () =>
      Effect.gen(function* () {
        yield* reset;
        const owner = yield* platformIdentity();
        const repository = yield* Repository;
        for (let index = 0; index < 26; index++) {
          yield* repository.auth.waitlist.join(testEmail(`person${index}@example.com`));
        }
        const first = yield* owner.client.adminWaitlist.list({ query: {} });
        expect(first.entries).toHaveLength(25);
        if (!first.nextCursor) return yield* Effect.die("Missing cursor");
        const second = yield* owner.client.adminWaitlist.list({
          query: { cursor: first.nextCursor },
        });
        expect(second.entries).toHaveLength(1);
        expect(second.nextCursor).toBeNull();
        expect(new Set([...first.entries, ...second.entries].map((entry) => entry.id)).size).toBe(
          26,
        );
        expect(
          (yield* owner.client.adminWaitlist.list({ query: { email: " PERSON25@EXAMPLE.COM " } }))
            .entries,
        ).toHaveLength(1);
        for (const email of ["%", "_"])
          expect(
            (yield* owner.client.adminWaitlist.list({ query: { email } })).entries,
          ).toHaveLength(0);
        expect(
          (yield* owner.client.adminWaitlist.list({ query: { status: "completed" } })).entries,
        ).toHaveLength(0);
        expect(
          (yield* owner.client.adminWaitlist.list({ query: { status: "pending", limit: 100 } }))
            .entries,
        ).toHaveLength(26);
        for (const query of [
          { limit: 0 },
          { limit: 101 },
          { cursor: "bad" },
          { status: "accepted" },
          { email: "a".repeat(255) },
        ]) {
          expect(Schema.is(ListWaitlistRequest)(query)).toBe(false);
        }
      }),
  );
});
