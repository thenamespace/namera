import { Context, DateTime, Effect, Layer, Metric, Result, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import type { DatabaseError } from "@namera-ai/protocol";
import { EmailJobPayload, type EmailJob, type EmailJobErrorCode } from "@namera-ai/protocol/model";
import {
  emailJobDeliveryDuration,
  emailJobDeliveryResults,
  emailJobsEnqueued,
} from "@namera-ai/telemetry";

import { emailPolicy, emailRetryDelay } from "./data.js";
import { EmailService } from "./layer.js";
import type { EnqueueEmailProps } from "./types.js";

export class EmailJobs extends Context.Service<
  EmailJobs,
  {
    readonly enqueue: (input: EnqueueEmailProps) => Effect.Effect<EmailJob, DatabaseError>;
    readonly processOnce: Effect.Effect<number, DatabaseError>;
  }
>()("@namera-ai/emails/EmailJobs") {
  static readonly layer = Layer.effect(
    EmailJobs,
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const email = yield* EmailService;
      const repository = yield* Repository;

      const decodePayload = Effect.fnUntraced(function* (encryptedPayload: string | null) {
        if (encryptedPayload === null) {
          return yield* Effect.fail("INVALID_PAYLOAD" as const);
        }

        const plaintext = yield* crypto
          .decrypt({ purpose: cryptoPurpose.emailOutbox, value: encryptedPayload })
          .pipe(Effect.mapError(() => "DECRYPT_FAILED" as const));
        const parsed = yield* Effect.try({
          try: () => JSON.parse(plaintext) as unknown,
          catch: () => "INVALID_PAYLOAD" as const,
        });
        return yield* Schema.decodeUnknownEffect(EmailJobPayload)(parsed).pipe(
          Effect.mapError(() => "INVALID_PAYLOAD" as const),
        );
      });

      const markTerminal = Effect.fnUntraced(function* (
        job: EmailJob,
        leaseToken: string,
        status: "failed" | "expired",
        lastErrorCode: EmailJobErrorCode | null,
        result: "failed" | "expired" | "invalid",
      ) {
        yield* repository.jobs.email.markTerminal({
          id: job.id,
          leaseToken,
          status,
          lastErrorCode,
        });
        yield* Metric.update(Metric.withAttributes(emailJobDeliveryResults, { result }), 1);
      });

      const enqueue = Effect.fn("emails.jobs.enqueue")(function* (input: EnqueueEmailProps) {
        const availableAt = input.availableAt ?? (yield* DateTime.now);
        const encodedPayload = Schema.encodeSync(EmailJobPayload)(input);
        const encryptedPayload = yield* crypto.encrypt({
          purpose: cryptoPurpose.emailOutbox,
          value: JSON.stringify(encodedPayload),
        });
        const { job, inserted } = yield* repository.jobs.email.enqueue({
          type: input.type,
          idempotencyKey: input.idempotencyKey,
          encryptedPayload,
          availableAt,
          expiresAt: input.expiresAt,
        });
        if (inserted) {
          yield* Metric.update(Metric.withAttributes(emailJobsEnqueued, { type: input.type }), 1);
        }
        return job;
      });

      const deliver = Effect.fn("emails.jobs.deliver")(function* (
        job: EmailJob,
        leaseToken: string,
      ) {
        const decoded = yield* Effect.result(decodePayload(job.encryptedPayload));
        if (Result.isFailure(decoded)) {
          yield* markTerminal(job, leaseToken, "failed", decoded.failure, "invalid");
          yield* Effect.logWarning("email.job.invalid").pipe(
            Effect.annotateLogs({ reason: decoded.failure }),
          );
          return 1;
        }

        const delivery = yield* Effect.result(
          email
            .send({ ...decoded.success, idempotencyKey: job.idempotencyKey })
            .pipe(Effect.trackDuration(emailJobDeliveryDuration)),
        );
        const completedAt = yield* DateTime.now;
        if (Result.isSuccess(delivery)) {
          yield* repository.jobs.email.markSent({
            id: job.id,
            leaseToken,
            providerMessageId: delivery.success,
            sentAt: completedAt,
          });
          yield* Metric.update(
            Metric.withAttributes(emailJobDeliveryResults, { result: "sent" }),
            1,
          );
          yield* Effect.logInfo("email.job.sent").pipe(Effect.annotateLogs({ type: job.type }));
          return 1;
        }

        const retryAt = DateTime.addDuration(completedAt, emailRetryDelay(job.attempts));
        if (DateTime.toEpochMillis(completedAt) >= DateTime.toEpochMillis(job.expiresAt)) {
          yield* markTerminal(job, leaseToken, "expired", delivery.failure.reason, "expired");
          return 1;
        }
        if (
          job.attempts >= emailPolicy.maximumAttempts ||
          DateTime.toEpochMillis(retryAt) >= DateTime.toEpochMillis(job.expiresAt)
        ) {
          yield* markTerminal(job, leaseToken, "failed", delivery.failure.reason, "failed");
          yield* Effect.logWarning("email.job.failed").pipe(
            Effect.annotateLogs({ type: job.type, reason: delivery.failure.reason }),
          );
          return 1;
        }

        yield* repository.jobs.email.reschedule({
          id: job.id,
          leaseToken,
          availableAt: retryAt,
          lastErrorCode: delivery.failure.reason,
        });
        yield* Metric.update(
          Metric.withAttributes(emailJobDeliveryResults, { result: "retry" }),
          1,
        );
        yield* Effect.logWarning("email.job.retry").pipe(
          Effect.annotateLogs({
            type: job.type,
            reason: delivery.failure.reason,
            attempt: job.attempts,
          }),
        );
        return 1;
      });

      const processOnce = Effect.fnUntraced(function* () {
        const now = yield* DateTime.now;
        const expired = yield* repository.jobs.email.expire(now);
        if (expired > 0) {
          yield* Metric.update(
            Metric.withAttributes(emailJobDeliveryResults, { result: "expired" }),
            expired,
          );
        }

        const leaseToken = yield* crypto.randomToken(18);
        const job = yield* repository.jobs.email.claim({
          now,
          leaseToken,
          leaseExpiresAt: DateTime.addDuration(now, emailPolicy.leaseDuration),
        });
        if (job === undefined) {
          return 0;
        }

        return yield* deliver(job, leaseToken).pipe(Effect.annotateSpans({ email_type: job.type }));
      });

      return EmailJobs.of({ enqueue, processOnce: processOnce() });
    }),
  );
}
