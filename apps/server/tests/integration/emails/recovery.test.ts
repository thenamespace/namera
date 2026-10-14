import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Exit } from "effect";
import { TestClock } from "effect/testing";

import { Database, Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";

import { resetTestState, testEmail } from "../../fixtures/index.js";
import { TestEmails, TestServerLayer } from "../../fixtures/layers/index.js";

const enqueue = Effect.fnUntraced(function* (key: string) {
  const jobs = yield* EmailJobs;
  return yield* jobs.enqueue({
    type: "magic-link",
    to: testEmail("recovery@example.com"),
    idempotencyKey: key,
    expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.hours(1)),
    variables: {
      magicLinkUrl: "http://dashboard.test/auth",
      code: "12345678",
      expiresInMinutes: 10,
    },
  });
});
const abandon = Effect.fnUntraced(function* (attempts: number) {
  const repository = yield* Repository;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const now = yield* DateTime.now;
    const claimed = yield* repository.jobs.email.claim({
      now,
      leaseToken: `abandoned-${attempt}`,
      leaseExpiresAt: DateTime.addDuration(now, Duration.seconds(30)),
    });
    expect(claimed?.attempts).toBe(attempt);
    yield* TestClock.adjust(Duration.seconds(31));
  }
});

layer(TestServerLayer)("email recovery attempt budget", (it) => {
  it.effect("permits the fifth attempt after four abandoned leases", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const job = yield* enqueue("fifth-attempt");
      yield* abandon(4);
      yield* (yield* EmailJobs).processOnce;
      expect(yield* (yield* Repository).jobs.email.findById(job.id)).toMatchObject({
        status: "sent",
        attempts: 5,
      });
      expect(yield* (yield* TestEmails).sent).toHaveLength(1);
    }),
  );

  it.effect("retires exhausted leases, fences stale workers and drains healthy jobs", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const exhausted = yield* enqueue("exhausted");
      yield* abandon(5);
      const healthy = yield* enqueue("healthy");
      const jobs = yield* EmailJobs;
      const repository = yield* Repository;
      const emails = yield* TestEmails;
      yield* Effect.all([jobs.processOnce, jobs.processOnce], { concurrency: "unbounded" });
      expect(yield* repository.jobs.email.findById(exhausted.id)).toMatchObject({
        status: "failed",
        encryptedPayload: null,
        leaseToken: null,
        leaseExpiresAt: null,
      });
      expect(yield* repository.jobs.email.findById(healthy.id)).toMatchObject({ status: "sent" });
      expect((yield* emails.sent).map((email) => email.idempotencyKey)).toEqual(["healthy"]);
      expect(
        yield* repository.jobs.email.markSent({
          id: exhausted.id,
          leaseToken: "abandoned-5",
          providerMessageId: "late",
          sentAt: yield* DateTime.now,
        }),
      ).toBeUndefined();
      expect(
        yield* repository.jobs.email.reschedule({
          id: exhausted.id,
          leaseToken: "abandoned-5",
          availableAt: yield* DateTime.now,
          lastErrorCode: "REQUEST_FAILED",
        }),
      ).toBeUndefined();
      expect(yield* jobs.processOnce).toBe(0);
    }),
  );

  it.effect("does not reclaim an active fifth lease", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const job = yield* enqueue("active-fifth");
      yield* abandon(4);
      const repository = yield* Repository;
      const now = yield* DateTime.now;
      yield* repository.jobs.email.claim({
        now,
        leaseToken: "active",
        leaseExpiresAt: DateTime.addDuration(now, Duration.seconds(30)),
      });
      expect(yield* (yield* EmailJobs).processOnce).toBe(0);
      expect(
        yield* repository.jobs.email.markSent({
          id: job.id,
          leaseToken: "active",
          providerMessageId: "accepted",
          sentAt: now,
        }),
      ).toMatchObject({ status: "sent", attempts: 5 });
    }),
  );

  it.effect("stops sending when provider acceptance cannot be persisted five times", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const job = yield* enqueue("completion-failure");
      const db = yield* Database;
      const jobs = yield* EmailJobs;
      yield* db.execute(
        "CREATE FUNCTION public.reject_email_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'sent' THEN RAISE EXCEPTION 'test completion failure'; END IF; RETURN NEW; END $$",
      );
      yield* db.execute(
        "CREATE TRIGGER reject_email_completion BEFORE UPDATE ON jobs.email_jobs FOR EACH ROW EXECUTE FUNCTION public.reject_email_completion()",
      );
      yield* Effect.gen(function* () {
        for (let attempt = 1; attempt <= 5; attempt += 1) {
          expect(Exit.isFailure(yield* Effect.exit(jobs.processOnce))).toBe(true);
          yield* TestClock.adjust(Duration.seconds(31));
        }
        expect(yield* jobs.processOnce).toBe(1);
        const messages = yield* (yield* TestEmails).sent;
        expect(messages).toHaveLength(5);
        expect(new Set(messages.map((email) => email.idempotencyKey))).toEqual(
          new Set(["completion-failure"]),
        );
        expect(yield* (yield* Repository).jobs.email.findById(job.id)).toMatchObject({
          status: "failed",
          encryptedPayload: null,
        });
      }).pipe(
        Effect.ensuring(
          Effect.gen(function* () {
            yield* db.execute("DROP TRIGGER reject_email_completion ON jobs.email_jobs");
            yield* db.execute("DROP FUNCTION public.reject_email_completion()");
          }).pipe(Effect.orDie),
        ),
      );
    }),
  );
});
