import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";

import {
  enqueueMagicLink,
  makeTestApiClient,
  resetTestState,
  testEmail,
} from "../helpers/index.js";
import { TestEmails, TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("email jobs", (it) => {
  it.effect("enqueues without blocking on provider delivery", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const requested = yield* enqueueMagicLink(client, testEmail("queued@example.com"));
      const emails = yield* TestEmails;

      expect(requested.response.status).toBe(202);
      expect(requested.job.status).toBe("pending");
      expect(requested.job.encryptedPayload).toBeTruthy();
      expect((yield* emails.sent).length).toBe(0);
    }),
  );

  it.effect("delivers a claimed job and clears its encrypted payload", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const requested = yield* enqueueMagicLink(client, testEmail("delivered@example.com"));
      const jobs = yield* EmailJobs;
      const repository = yield* Repository;
      const emails = yield* TestEmails;

      expect(yield* jobs.processOnce).toBe(1);
      const delivered = yield* repository.jobs.email.findById(requested.job.id);

      expect(delivered).toMatchObject({
        status: "sent",
        attempts: 1,
        encryptedPayload: null,
        providerMessageId: "test",
      });
      expect((yield* emails.sent).length).toBe(1);
    }),
  );

  it.effect("returns the existing job for a repeated idempotency key", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const jobs = yield* EmailJobs;
      const now = yield* DateTime.now;
      const input = {
        type: "magic-link" as const,
        to: testEmail("idempotent@example.com"),
        idempotencyKey: "email-job-idempotency-test",
        expiresAt: DateTime.addDuration(now, Duration.hours(1)),
        variables: {
          magicLinkUrl: "http://dashboard.test/auth/verify",
          code: "12345678",
          expiresInMinutes: 10,
        },
      };

      const first = yield* jobs.enqueue(input);
      const second = yield* jobs.enqueue(input);

      expect(second.id).toBe(first.id);
    }),
  );

  it.effect("reschedules a transient provider failure and later delivers", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const requested = yield* enqueueMagicLink(client, testEmail("retry@example.com"));
      const jobs = yield* EmailJobs;
      const repository = yield* Repository;
      const emails = yield* TestEmails;

      yield* emails.failNext();
      expect(yield* jobs.processOnce).toBe(1);
      const retrying = yield* repository.jobs.email.findById(requested.job.id);
      expect(retrying).toMatchObject({
        status: "pending",
        attempts: 1,
        lastErrorCode: "REQUEST_FAILED",
      });
      expect((yield* emails.sent).length).toBe(0);

      yield* TestClock.adjust(Duration.seconds(5));
      expect(yield* jobs.processOnce).toBe(1);
      expect(yield* repository.jobs.email.findById(requested.job.id)).toMatchObject({
        status: "sent",
        attempts: 2,
        encryptedPayload: null,
      });
      expect((yield* emails.sent).length).toBe(1);
    }),
  );

  it.effect("marks an invalid encrypted payload as failed without sending", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const repository = yield* Repository;
      const jobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      const now = yield* DateTime.now;
      const { job } = yield* repository.jobs.email.enqueue({
        type: "magic-link",
        idempotencyKey: "invalid-email-payload-test",
        encryptedPayload: "not-ciphertext",
        availableAt: now,
        expiresAt: DateTime.addDuration(now, Duration.hours(1)),
      });

      expect(yield* jobs.processOnce).toBe(1);
      expect(yield* repository.jobs.email.findById(job.id)).toMatchObject({
        status: "failed",
        encryptedPayload: null,
        lastErrorCode: "DECRYPT_FAILED",
      });
      expect((yield* emails.sent).length).toBe(0);
    }),
  );

  it.effect("stops retrying after the configured maximum attempts", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const requested = yield* enqueueMagicLink(client, testEmail("failed@example.com"));
      const jobs = yield* EmailJobs;
      const repository = yield* Repository;
      const emails = yield* TestEmails;

      yield* emails.failNext(5);
      for (const delay of [0, 5, 10, 20, 40]) {
        if (delay > 0) {
          yield* TestClock.adjust(Duration.seconds(delay));
        }
        expect(yield* jobs.processOnce).toBe(1);
      }

      expect(yield* repository.jobs.email.findById(requested.job.id)).toMatchObject({
        status: "failed",
        attempts: 5,
        encryptedPayload: null,
        lastErrorCode: "REQUEST_FAILED",
      });
      expect((yield* emails.sent).length).toBe(0);
    }),
  );

  it.effect("expires a pending job without contacting the provider", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const repository = yield* Repository;
      const jobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      const now = yield* DateTime.now;
      const { job } = yield* repository.jobs.email.enqueue({
        type: "magic-link",
        idempotencyKey: "expired-email-job-test",
        encryptedPayload: "ciphertext",
        availableAt: now,
        expiresAt: now,
      });

      expect(yield* jobs.processOnce).toBe(0);
      expect(yield* repository.jobs.email.findById(job.id)).toMatchObject({
        status: "expired",
        encryptedPayload: null,
      });
      expect((yield* emails.sent).length).toBe(0);
    }),
  );

  it.effect("reclaims a job after its processing lease expires", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const repository = yield* Repository;
      const now = yield* DateTime.now;
      yield* repository.jobs.email.enqueue({
        type: "magic-link",
        idempotencyKey: "stale-email-lease-test",
        encryptedPayload: "ciphertext",
        availableAt: now,
        expiresAt: DateTime.addDuration(now, Duration.hours(1)),
      });

      const first = yield* repository.jobs.email.claim({
        now,
        leaseToken: "first-lease",
        leaseExpiresAt: DateTime.addDuration(now, Duration.seconds(1)),
      });
      expect(first?.attempts).toBe(1);

      yield* TestClock.adjust(Duration.seconds(2));
      const reclaimedAt = yield* DateTime.now;
      const reclaimed = yield* repository.jobs.email.claim({
        now: reclaimedAt,
        leaseToken: "second-lease",
        leaseExpiresAt: DateTime.addDuration(reclaimedAt, Duration.seconds(30)),
      });

      expect(reclaimed).toMatchObject({
        status: "processing",
        attempts: 2,
        leaseToken: "second-lease",
      });
    }),
  );

  it.effect("allows concurrent processors to deliver a job only once", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const jobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      const now = yield* DateTime.now;
      yield* jobs.enqueue({
        type: "magic-link",
        to: testEmail("concurrent@example.com"),
        idempotencyKey: "concurrent-email-job-test",
        expiresAt: DateTime.addDuration(now, Duration.hours(1)),
        variables: {
          magicLinkUrl: "http://dashboard.test/auth/verify",
          code: "12345678",
          expiresInMinutes: 10,
        },
      });

      const processed = yield* Effect.all([jobs.processOnce, jobs.processOnce], {
        concurrency: "unbounded",
      });

      expect(processed.toSorted()).toEqual([0, 1]);
      expect((yield* emails.sent).length).toBe(1);
    }),
  );
});
