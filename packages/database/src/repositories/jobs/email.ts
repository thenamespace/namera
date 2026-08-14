// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, EmailJobId } from "@namera-ai/protocol";
import { EmailJob, EmailJobInsert, type EmailJobErrorCode } from "@namera-ai/protocol/model";
import { and, asc, eq, gt, inArray, lte, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { emailJob } from "#/schema/index";

export interface EmailJobRepositoryService {
  readonly enqueue: (
    data: EmailJobInsert,
  ) => Effect.Effect<{ readonly job: EmailJob; readonly inserted: boolean }, DatabaseError>;
  readonly findById: (id: EmailJobId) => Effect.Effect<EmailJob | undefined, DatabaseError>;
  readonly findByIdempotencyKey: (
    idempotencyKey: string,
  ) => Effect.Effect<EmailJob | undefined, DatabaseError>;
  readonly cancelPendingByIdempotencyKey: (
    idempotencyKey: string,
  ) => Effect.Effect<EmailJob | undefined, DatabaseError>;
  readonly claim: (input: {
    readonly now: DateTime.Utc;
    readonly leaseToken: string;
    readonly leaseExpiresAt: DateTime.Utc;
  }) => Effect.Effect<EmailJob | undefined, DatabaseError>;
  readonly markSent: (input: {
    readonly id: EmailJobId;
    readonly leaseToken: string;
    readonly providerMessageId: string;
    readonly sentAt: DateTime.Utc;
  }) => Effect.Effect<EmailJob | undefined, DatabaseError>;
  readonly reschedule: (input: {
    readonly id: EmailJobId;
    readonly leaseToken: string;
    readonly availableAt: DateTime.Utc;
    readonly lastErrorCode: EmailJobErrorCode;
  }) => Effect.Effect<EmailJob | undefined, DatabaseError>;
  readonly markTerminal: (input: {
    readonly id: EmailJobId;
    readonly leaseToken: string;
    readonly status: "failed" | "expired";
    readonly lastErrorCode: EmailJobErrorCode | null;
  }) => Effect.Effect<EmailJob | undefined, DatabaseError>;
  readonly expire: (now: DateTime.Utc) => Effect.Effect<number, DatabaseError>;
}

const encodeDate = Schema.encodeSync(Schema.DateTimeUtcFromDate);

export class EmailJobRepository extends Context.Service<
  EmailJobRepository,
  EmailJobRepositoryService
>()("@namera-ai/database/EmailJobRepository") {
  static readonly layer: Layer.Layer<EmailJobRepository, never, Database> = Layer.effect(
    EmailJobRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return EmailJobRepository.of({
        enqueue: Effect.fn("database.emailJobRepository.enqueue")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(EmailJobInsert)(data);
          const inserted = yield* db
            .insert(emailJob)
            .values(encoded as any)
            .onConflictDoNothing({ target: emailJob.idempotencyKey })
            .returning();
          if (inserted[0]) {
            return { job: Schema.decodeSync(EmailJob)(inserted[0]), inserted: true };
          }

          const existing = yield* db.query.emailJob.findFirst({
            where: { idempotencyKey: { eq: data.idempotencyKey } },
          });
          return { job: Schema.decodeSync(EmailJob)(existing!), inserted: false };
        }, mapRepositoryError),
        findById: Effect.fn("database.emailJobRepository.findById")(function* (id) {
          const db = yield* transactionOrDatabase(database);
          const row = yield* db.query.emailJob.findFirst({ where: { id: { eq: id } } });
          return row ? Schema.decodeSync(EmailJob)(row) : undefined;
        }, mapRepositoryError),
        findByIdempotencyKey: Effect.fn("database.emailJobRepository.findByIdempotencyKey")(
          function* (idempotencyKey) {
            const db = yield* transactionOrDatabase(database);
            const row = yield* db.query.emailJob.findFirst({
              where: { idempotencyKey: { eq: idempotencyKey } },
            });
            return row ? Schema.decodeSync(EmailJob)(row) : undefined;
          },
          mapRepositoryError,
        ),
        cancelPendingByIdempotencyKey: Effect.fn(
          "database.emailJobRepository.cancelPendingByIdempotencyKey",
        )(function* (idempotencyKey) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(emailJob)
            .set({
              status: "canceled",
              encryptedPayload: null,
              leaseToken: null,
              leaseExpiresAt: null,
            })
            .where(and(eq(emailJob.idempotencyKey, idempotencyKey), eq(emailJob.status, "pending")))
            .returning();
          return rows[0] ? Schema.decodeSync(EmailJob)(rows[0]) : undefined;
        }, mapRepositoryError),
        claim: Effect.fn("database.emailJobRepository.claim")(function* ({
          now,
          leaseToken,
          leaseExpiresAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const encodedNow = encodeDate(now);
          const candidate = db
            .select({ id: emailJob.id })
            .from(emailJob)
            .where(
              and(
                gt(emailJob.expiresAt, encodedNow),
                or(
                  and(eq(emailJob.status, "pending"), lte(emailJob.availableAt, encodedNow)),
                  and(eq(emailJob.status, "processing"), lte(emailJob.leaseExpiresAt, encodedNow)),
                ),
              ),
            )
            .orderBy(asc(emailJob.availableAt), asc(emailJob.createdAt))
            .limit(1)
            .for("update", { skipLocked: true });
          const rows = yield* db
            .update(emailJob)
            .set({
              status: "processing",
              attempts: sql`${emailJob.attempts} + 1`,
              leaseToken,
              leaseExpiresAt: encodeDate(leaseExpiresAt),
            })
            .where(inArray(emailJob.id, candidate))
            .returning();
          return rows[0] ? Schema.decodeSync(EmailJob)(rows[0]) : undefined;
        }, mapRepositoryError),
        markSent: Effect.fn("database.emailJobRepository.markSent")(function* ({
          id,
          leaseToken,
          providerMessageId,
          sentAt,
        }) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(emailJob)
            .set({
              status: "sent",
              encryptedPayload: null,
              providerMessageId,
              sentAt: encodeDate(sentAt),
              lastErrorCode: null,
              leaseToken: null,
              leaseExpiresAt: null,
            })
            .where(
              and(
                eq(emailJob.id, id),
                eq(emailJob.status, "processing"),
                eq(emailJob.leaseToken, leaseToken),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(EmailJob)(rows[0]) : undefined;
        }, mapRepositoryError),
        reschedule: Effect.fn("database.emailJobRepository.reschedule")(function* ({
          id,
          leaseToken,
          availableAt,
          lastErrorCode,
        }) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(emailJob)
            .set({
              status: "pending",
              availableAt: encodeDate(availableAt),
              lastErrorCode,
              leaseToken: null,
              leaseExpiresAt: null,
            })
            .where(
              and(
                eq(emailJob.id, id),
                eq(emailJob.status, "processing"),
                eq(emailJob.leaseToken, leaseToken),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(EmailJob)(rows[0]) : undefined;
        }, mapRepositoryError),
        markTerminal: Effect.fn("database.emailJobRepository.markTerminal")(function* ({
          id,
          leaseToken,
          status,
          lastErrorCode,
        }) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(emailJob)
            .set({
              status,
              encryptedPayload: null,
              lastErrorCode,
              leaseToken: null,
              leaseExpiresAt: null,
            })
            .where(
              and(
                eq(emailJob.id, id),
                eq(emailJob.status, "processing"),
                eq(emailJob.leaseToken, leaseToken),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(EmailJob)(rows[0]) : undefined;
        }, mapRepositoryError),
        expire: Effect.fn("database.emailJobRepository.expire")(function* (now) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(emailJob)
            .set({
              status: "expired",
              encryptedPayload: null,
              leaseToken: null,
              leaseExpiresAt: null,
            })
            .where(
              and(
                or(
                  eq(emailJob.status, "pending"),
                  and(
                    eq(emailJob.status, "processing"),
                    lte(emailJob.leaseExpiresAt, encodeDate(now)),
                  ),
                ),
                lte(emailJob.expiresAt, encodeDate(now)),
              ),
            )
            .returning({ id: emailJob.id });
          return rows.length;
        }, mapRepositoryError),
      });
    }),
  );
}
