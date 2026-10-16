import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { OrganizationId, SigningKeyId } from "@namera-ai/protocol";
import {
  SigningKeyDeactivation,
  type SigningKeyDeactivationErrorCode,
} from "@namera-ai/protocol/model";
import { and, asc, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { signingKeyDeactivation as job } from "#/schema/index";

interface SignerScope {
  readonly organizationId: OrganizationId;
  readonly signingKeyId: SigningKeyId;
}

interface LeasedJob {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly leaseToken: string;
  readonly now: DateTime.Utc;
}

const leased = (input: LeasedJob) =>
  and(
    eq(job.id, input.id),
    eq(job.organizationId, input.organizationId),
    eq(job.status, "pending"),
    eq(job.leaseToken, input.leaseToken),
    gt(job.leaseExpiresAt, DateTime.toDate(input.now)),
  );

const make = Effect.gen(function* () {
  const database = yield* Database;

  return {
    getBacklog: Effect.fnUntraced(function* (now: DateTime.Utc) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .select({
          count: sql<number>`count(*)`.mapWith(Number),
          oldestAgeSeconds:
            sql<number>`coalesce(greatest(0, extract(epoch from ${DateTime.toDate(now)}::timestamptz - min(${job.createdAt}))), 0)`.mapWith(
              Number,
            ),
        })
        .from(job)
        .where(ne(job.status, "completed"));
      return Schema.decodeUnknownSync(
        Schema.Struct({ count: Schema.Number, oldestAgeSeconds: Schema.Number }),
      )(rows[0]);
    }, mapRepositoryError),
    enqueue: Effect.fn("database.signingKeyDeactivation.enqueue")(function* (input: SignerScope) {
      const db = yield* transactionOrDatabase(database);
      const now = DateTime.toDate(yield* DateTime.now);
      const rows = yield* db
        .insert(job)
        .values({
          ...input,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: [job.signingKeyId, job.organizationId] })
        .returning();
      return rows[0] ? Schema.decodeUnknownSync(SigningKeyDeactivation)(rows[0]) : undefined;
    }, mapRepositoryError),
    findForSigner: Effect.fn("database.signingKeyDeactivation.findForSigner")(function* (
      input: SignerScope,
    ) {
      const db = yield* transactionOrDatabase(database);
      const row = yield* db.query.signingKeyDeactivation.findFirst({
        where: {
          organizationId: { eq: input.organizationId },
          signingKeyId: { eq: input.signingKeyId },
        },
      });
      return row ? Schema.decodeUnknownSync(SigningKeyDeactivation)(row) : undefined;
    }, mapRepositoryError),
    claim: Effect.fn("database.signingKeyDeactivation.claim")(function* (input: {
      readonly now: DateTime.Utc;
      readonly leaseToken: string;
      readonly leaseExpiresAt: DateTime.Utc;
    }) {
      const db = yield* transactionOrDatabase(database);
      const now = DateTime.toDate(input.now);
      const candidate = db
        .select({ id: job.id })
        .from(job)
        .where(
          and(
            eq(job.status, "pending"),
            lte(job.availableAt, now),
            or(isNull(job.leaseExpiresAt), lte(job.leaseExpiresAt, now)),
          ),
        )
        .orderBy(asc(job.availableAt), asc(job.id))
        .limit(1)
        .for("update", { skipLocked: true });
      const rows = yield* db
        .update(job)
        .set({
          attempts: sql`${job.attempts} + 1`,
          leaseToken: input.leaseToken,
          leaseExpiresAt: DateTime.toDate(input.leaseExpiresAt),
          updatedAt: now,
        })
        .where(eq(job.id, sql`(${candidate})`))
        .returning();
      return rows[0] ? Schema.decodeUnknownSync(SigningKeyDeactivation)(rows[0]) : undefined;
    }, mapRepositoryError),
    complete: Effect.fn("database.signingKeyDeactivation.complete")(function* (input: LeasedJob) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .update(job)
        .set({
          status: "completed",
          completedAt: DateTime.toDate(input.now),
          updatedAt: DateTime.toDate(input.now),
          lastErrorCode: null,
          leaseToken: null,
          leaseExpiresAt: null,
        })
        .where(leased(input))
        .returning();
      return rows[0] ? Schema.decodeUnknownSync(SigningKeyDeactivation)(rows[0]) : undefined;
    }, mapRepositoryError),
    fail: Effect.fn("database.signingKeyDeactivation.fail")(function* (
      input: LeasedJob & {
        readonly status: "pending" | "needs-attention";
        readonly availableAt: DateTime.Utc;
        readonly lastErrorCode: SigningKeyDeactivationErrorCode;
      },
    ) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .update(job)
        .set({
          status: input.status,
          availableAt: DateTime.toDate(input.availableAt),
          updatedAt: DateTime.toDate(input.now),
          lastErrorCode: input.lastErrorCode,
          leaseToken: null,
          leaseExpiresAt: null,
        })
        .where(leased(input))
        .returning();
      return rows[0] ? Schema.decodeUnknownSync(SigningKeyDeactivation)(rows[0]) : undefined;
    }, mapRepositoryError),
  };
});

export class SigningKeyDeactivationRepository extends Context.Service<
  SigningKeyDeactivationRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/SigningKeyDeactivationRepository") {
  static readonly layer = Layer.effect(SigningKeyDeactivationRepository, make);
}
