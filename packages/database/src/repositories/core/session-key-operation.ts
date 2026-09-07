import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import {
  EvmSignedExecution,
  type ActorId,
  type DatabaseError,
  type OrganizationId,
  type SessionKeyInstallationId,
  type SessionKeyOperationId,
  type TransactionHash,
  type UserOperationHash,
} from "@namera-ai/protocol";
import { SessionKeyOperation, SessionKeyOperationInsert } from "@namera-ai/protocol/model";
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKeyOperation as table } from "#/schema/index";

type Scope = { readonly id: SessionKeyOperationId; readonly organizationId: OrganizationId };
type Lease = Scope & { readonly leaseToken: string; readonly now: DateTime.Utc };
type Result = Effect.Effect<SessionKeyOperation | undefined, DatabaseError>;
type Batch = Effect.Effect<ReadonlyArray<SessionKeyOperation>, DatabaseError>;

export interface SessionKeyOperationRepositoryService {
  readonly insert: (
    input: SessionKeyOperationInsert,
  ) => Effect.Effect<
    { readonly operation: SessionKeyOperation; readonly inserted: boolean },
    DatabaseError
  >;
  readonly findById: (scope: Scope) => Result;
  readonly findByActorAndIdempotencyKey: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly idempotencyKey: string;
  }) => Result;
  readonly findActiveForInstallation: (input: {
    readonly organizationId: OrganizationId;
    readonly installationId: SessionKeyInstallationId;
    readonly kind: SessionKeyOperation["kind"];
  }) => Result;
  readonly acceptSignature: (
    input: Scope & {
      readonly actorId: ActorId;
      readonly requestHash: string;
      readonly signed: EvmSignedExecution;
      readonly now: DateTime.Utc;
      readonly leaseToken: string;
      readonly leaseExpiresAt: DateTime.Utc;
    },
  ) => Result;
  readonly markSubmitted: (input: Lease) => Result;
  readonly finishReceipt: (
    input: Lease & {
      readonly userOperationHash: UserOperationHash;
      readonly transactionHash: TransactionHash;
      readonly success: boolean;
    },
  ) => Result;
  readonly claimForReconciliation: (input: {
    readonly now: DateTime.Utc;
    readonly leaseToken: string;
    readonly leaseExpiresAt: DateTime.Utc;
    readonly limit: number;
  }) => Batch;
  readonly releaseLease: (input: Lease & { readonly nextReconcileAt: DateTime.Utc }) => Result;
  readonly expireAwaitingSignatures: (input: {
    readonly now: DateTime.Utc;
    readonly limit: number;
  }) => Batch;
}

const date = Schema.encodeSync(Schema.DateTimeUtcFromDate);
const scoped = (scope: Scope) =>
  and(eq(table.id, scope.id), eq(table.organizationId, scope.organizationId));
const leased = (input: Lease) =>
  and(
    scoped(input),
    eq(table.leaseToken, input.leaseToken),
    gt(table.leaseExpiresAt, date(input.now)),
  );
const decode = (rows: ReadonlyArray<typeof table.$inferSelect>) =>
  rows[0] === undefined ? undefined : Schema.decodeSync(SessionKeyOperation)(rows[0]);
const decodeBatch = (rows: ReadonlyArray<typeof table.$inferSelect>) =>
  rows.map((row) => Schema.decodeSync(SessionKeyOperation)(row));

export class SessionKeyOperationRepository extends Context.Service<
  SessionKeyOperationRepository,
  SessionKeyOperationRepositoryService
>()("@namera-ai/database/SessionKeyOperationRepository") {
  static readonly layer = Layer.effect(
    SessionKeyOperationRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return SessionKeyOperationRepository.of({
        insert: Effect.fn("database.sessionKeyOperation.insert")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .insert(table)
            .values({
              ...Schema.encodeSync(SessionKeyOperationInsert)(input),
              id: input.id,
              organizationId: input.organizationId,
              actorId: input.actorId,
              installationId: input.installationId,
              walletId: input.walletId,
            })
            .onConflictDoNothing({
              target: [table.organizationId, table.actorId, table.idempotencyKey],
            })
            .returning();
          if (rows[0] !== undefined)
            return { operation: Schema.decodeSync(SessionKeyOperation)(rows[0]), inserted: true };
          const existing = yield* db
            .select()
            .from(table)
            .where(
              and(
                eq(table.organizationId, input.organizationId),
                eq(table.actorId, input.actorId),
                eq(table.idempotencyKey, input.idempotencyKey),
              ),
            )
            .limit(1);
          return {
            operation: Schema.decodeUnknownSync(SessionKeyOperation)(existing[0]),
            inserted: false,
          };
        }, mapRepositoryError),
        findById: Effect.fn("database.sessionKeyOperation.findById")(function* (scope) {
          const db = yield* transactionOrDatabase(database);
          return decode(yield* db.select().from(table).where(scoped(scope)).limit(1));
        }, mapRepositoryError),
        findByActorAndIdempotencyKey: Effect.fn(
          "database.sessionKeyOperation.findByActorAndIdempotencyKey",
        )(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .select()
              .from(table)
              .where(
                and(
                  eq(table.organizationId, input.organizationId),
                  eq(table.actorId, input.actorId),
                  eq(table.idempotencyKey, input.idempotencyKey),
                ),
              )
              .limit(1),
          );
        }, mapRepositoryError),
        findActiveForInstallation: Effect.fn(
          "database.sessionKeyOperation.findActiveForInstallation",
        )(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .select()
              .from(table)
              .where(
                and(
                  eq(table.organizationId, input.organizationId),
                  eq(table.installationId, input.installationId),
                  eq(table.kind, input.kind),
                  inArray(table.status, ["awaiting-signature", "signed", "submitted"]),
                ),
              )
              .limit(1),
          );
        }, mapRepositoryError),
        acceptSignature: Effect.fn("database.sessionKeyOperation.acceptSignature")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          const signed = JSON.stringify(Schema.encodeSync(EvmSignedExecution)(input.signed));
          return decode(
            yield* db
              .update(table)
              .set({
                status: "signed",
                data: sql`jsonb_set(${table.data}, '{signed}', ${signed}::jsonb)`,
                leaseToken: input.leaseToken,
                leaseExpiresAt: date(input.leaseExpiresAt),
              })
              .where(
                and(
                  scoped(input),
                  eq(table.actorId, input.actorId),
                  eq(table.requestHash, input.requestHash),
                  eq(table.status, "awaiting-signature"),
                  gt(table.expiresAt, date(input.now)),
                  sql`${date(input.leaseExpiresAt)}::timestamptz > ${date(input.now)}::timestamptz`,
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
        markSubmitted: Effect.fn("database.sessionKeyOperation.markSubmitted")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({ status: "submitted" })
              .where(and(leased(input), eq(table.status, "signed")))
              .returning(),
          );
        }, mapRepositoryError),
        finishReceipt: Effect.fn("database.sessionKeyOperation.finishReceipt")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({
                status: input.success ? "confirmed" : "failed",
                transactionHash: input.transactionHash,
                finishedAt: date(input.now),
                leaseToken: null,
                leaseExpiresAt: null,
              })
              .where(
                and(
                  leased(input),
                  inArray(table.status, ["signed", "submitted"]),
                  sql`${table.data}->'signed'->>'userOperationHash' = ${input.userOperationHash}`,
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
        claimForReconciliation: Effect.fn("database.sessionKeyOperation.claimForReconciliation")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            const due = db
              .select({ id: table.id })
              .from(table)
              .where(
                and(
                  inArray(table.status, ["signed", "submitted"]),
                  or(isNull(table.leaseExpiresAt), lte(table.leaseExpiresAt, date(input.now))),
                  sql`${date(input.leaseExpiresAt)}::timestamptz > ${date(input.now)}::timestamptz`,
                ),
              )
              .orderBy(asc(table.createdAt), asc(table.id))
              .limit(input.limit)
              .for("update", { skipLocked: true });
            return decodeBatch(
              yield* db
                .update(table)
                .set({ leaseToken: input.leaseToken, leaseExpiresAt: date(input.leaseExpiresAt) })
                .where(inArray(table.id, due))
                .returning(),
            );
          },
          mapRepositoryError,
        ),
        releaseLease: Effect.fn("database.sessionKeyOperation.releaseLease")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({ leaseToken: null, leaseExpiresAt: date(input.nextReconcileAt) })
              .where(and(leased(input), inArray(table.status, ["signed", "submitted"])))
              .returning(),
          );
        }, mapRepositoryError),
        expireAwaitingSignatures: Effect.fn(
          "database.sessionKeyOperation.expireAwaitingSignatures",
        )(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const due = db
            .select({ id: table.id })
            .from(table)
            .where(
              and(eq(table.status, "awaiting-signature"), lte(table.expiresAt, date(input.now))),
            )
            .orderBy(asc(table.expiresAt), asc(table.id))
            .limit(input.limit)
            .for("update", { skipLocked: true });
          return decodeBatch(
            yield* db
              .update(table)
              .set({ status: "expired", finishedAt: date(input.now) })
              .where(inArray(table.id, due))
              .returning(),
          );
        }, mapRepositoryError),
      });
    }),
  );
}
