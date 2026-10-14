import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import {
  EvmSignedExecution,
  type ActorId,
  type DatabaseError,
  type OrganizationId,
  type WalletOperationId,
  type TransactionHash,
  type UserOperationHash,
  type WalletId,
  type SupportedEvmChainId,
} from "@namera-ai/protocol";
import { WalletOperation, WalletOperationInsert } from "@namera-ai/protocol/model";
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { walletOperation as table } from "#/schema/index";

type Scope = { readonly id: WalletOperationId; readonly organizationId: OrganizationId };
type Lease = Scope & { readonly leaseToken: string; readonly now: DateTime.Utc };
type Result = Effect.Effect<WalletOperation | undefined, DatabaseError>;
type Batch = Effect.Effect<ReadonlyArray<WalletOperation>, DatabaseError>;

export interface WalletOperationRepositoryService {
  readonly claimForSigning: (
    input: Lease & { readonly actorId: ActorId; readonly leaseExpiresAt: DateTime.Utc },
  ) => Result;
  readonly releaseSigningLease: (input: Scope & { readonly leaseToken: string }) => Result;
  readonly getBacklog: (
    now: DateTime.Utc,
  ) => Effect.Effect<{ readonly count: number; readonly oldestAgeSeconds: number }, DatabaseError>;
  readonly insert: (
    input: WalletOperationInsert,
  ) => Effect.Effect<
    { readonly operation: WalletOperation; readonly inserted: boolean },
    DatabaseError
  >;
  readonly findById: (scope: Scope) => Result;
  readonly findLatestForCall: (input: {
    readonly organizationId: OrganizationId;
    readonly walletId: WalletId;
    readonly chainId: SupportedEvmChainId;
    readonly to: string;
    readonly data: string;
  }) => Result;
  readonly findByActorAndIdempotencyKey: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly idempotencyKey: string;
  }) => Result;
  readonly findActiveForWalletChain: (input: {
    readonly organizationId: OrganizationId;
    readonly walletId: WalletId;
    readonly chainId: SupportedEvmChainId;
  }) => Result;
  readonly acceptSignature: (
    input: Scope & {
      readonly actorId: ActorId;
      readonly requestHash: string;
      readonly signed: EvmSignedExecution;
      readonly now: DateTime.Utc;
      readonly leaseToken: string;
      readonly leaseExpiresAt: DateTime.Utc;
      readonly signingLeaseToken?: string;
    },
  ) => Result;
  readonly markSubmitted: (input: Lease) => Result;
  readonly recordBroadcastAttempt: (input: Lease) => Result;
  readonly blockSubmission: (input: Lease) => Result;
  readonly rejectSubmission: (input: Lease) => Result;
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
  readonly releaseLease: (
    input: Lease & {
      readonly nextReconcileAt: DateTime.Utc;
      readonly reconciliation?: NonNullable<WalletOperation["data"]["reconciliation"]>;
    },
  ) => Result;
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
  rows[0] === undefined ? undefined : Schema.decodeSync(WalletOperation)(rows[0]);
const decodeBatch = (rows: ReadonlyArray<typeof table.$inferSelect>) =>
  rows.map((row) => Schema.decodeSync(WalletOperation)(row));

export class WalletOperationRepository extends Context.Service<
  WalletOperationRepository,
  WalletOperationRepositoryService
>()("@namera-ai/database/WalletOperationRepository") {
  static readonly layer = Layer.effect(
    WalletOperationRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return WalletOperationRepository.of({
        claimForSigning: Effect.fn("database.walletOperation.claimForSigning")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({
                leaseToken: input.leaseToken,
                leaseExpiresAt: date(input.leaseExpiresAt),
              })
              .where(
                and(
                  scoped(input),
                  eq(table.actorId, input.actorId),
                  eq(table.status, "awaiting-signature"),
                  gt(table.expiresAt, date(input.now)),
                  or(isNull(table.leaseExpiresAt), lte(table.leaseExpiresAt, date(input.now))),
                  sql`${date(input.leaseExpiresAt)}::timestamptz > ${date(input.now)}::timestamptz`,
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
        releaseSigningLease: Effect.fn("database.walletOperation.releaseSigningLease")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({ leaseToken: null, leaseExpiresAt: null })
              .where(
                and(
                  scoped(input),
                  eq(table.status, "awaiting-signature"),
                  eq(table.leaseToken, input.leaseToken),
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
        getBacklog: Effect.fnUntraced(function* (now: DateTime.Utc) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({
              count: sql<number>`count(*)`.mapWith(Number),
              oldestAgeSeconds:
                sql<number>`coalesce(greatest(0, extract(epoch from ${date(now)}::timestamptz - min(${table.createdAt}))), 0)`.mapWith(
                  Number,
                ),
            })
            .from(table)
            .where(inArray(table.status, ["signed", "submitted"]));
          return Schema.decodeUnknownSync(
            Schema.Struct({ count: Schema.Number, oldestAgeSeconds: Schema.Number }),
          )(rows[0]);
        }, mapRepositoryError),
        insert: Effect.fn("database.walletOperation.insert")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .insert(table)
            .values({
              ...Schema.encodeSync(WalletOperationInsert)(input),
              id: input.id,
              organizationId: input.organizationId,
              actorId: input.actorId,
              walletId: input.walletId,
            })
            .onConflictDoNothing({
              target: [table.organizationId, table.actorId, table.idempotencyKey],
            })
            .returning();
          if (rows[0] !== undefined)
            return { operation: Schema.decodeSync(WalletOperation)(rows[0]), inserted: true };
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
            operation: Schema.decodeUnknownSync(WalletOperation)(existing[0]),
            inserted: false,
          };
        }, mapRepositoryError),
        findById: Effect.fn("database.walletOperation.findById")(function* (scope) {
          const db = yield* transactionOrDatabase(database);
          return decode(yield* db.select().from(table).where(scoped(scope)).limit(1));
        }, mapRepositoryError),
        findLatestForCall: Effect.fn("database.walletOperation.findLatestForCall")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .select()
              .from(table)
              .where(
                and(
                  eq(table.organizationId, input.organizationId),
                  eq(table.walletId, input.walletId),
                  eq(table.chainId, input.chainId),
                  sql`jsonb_array_length(${table.data}->'prepared'->'context'->'calls') = 1`,
                  sql`lower(${table.data}->'prepared'->'context'->'calls'->0->>'to') = ${input.to.toLowerCase()}`,
                  sql`lower(${table.data}->'prepared'->'context'->'calls'->0->>'data') = ${input.data.toLowerCase()}`,
                  sql`${table.data}->'prepared'->'context'->'calls'->0->>'value' = '0'`,
                ),
              )
              .orderBy(sql`${table.createdAt} desc`, sql`${table.id} desc`)
              .limit(1),
          );
        }, mapRepositoryError),
        findByActorAndIdempotencyKey: Effect.fn(
          "database.walletOperation.findByActorAndIdempotencyKey",
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
        findActiveForWalletChain: Effect.fn("database.walletOperation.findActiveForWalletChain")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            return decode(
              yield* db
                .select()
                .from(table)
                .where(
                  and(
                    eq(table.organizationId, input.organizationId),
                    eq(table.walletId, input.walletId),
                    eq(table.chainId, input.chainId),
                    inArray(table.status, ["awaiting-signature", "signed", "submitted"]),
                  ),
                )
                .limit(1),
            );
          },
          mapRepositoryError,
        ),
        acceptSignature: Effect.fn("database.walletOperation.acceptSignature")(function* (input) {
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
                  input.signingLeaseToken === undefined
                    ? isNull(table.leaseToken)
                    : and(
                        eq(table.leaseToken, input.signingLeaseToken),
                        gt(table.leaseExpiresAt, date(input.now)),
                      ),
                  gt(table.expiresAt, date(input.now)),
                  sql`${date(input.leaseExpiresAt)}::timestamptz > ${date(input.now)}::timestamptz`,
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
        markSubmitted: Effect.fn("database.walletOperation.markSubmitted")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({ status: "submitted" })
              .where(and(leased(input), eq(table.status, "signed")))
              .returning(),
          );
        }, mapRepositoryError),
        recordBroadcastAttempt: Effect.fn("database.walletOperation.recordBroadcastAttempt")(
          function* (input) {
            const db = yield* transactionOrDatabase(database);
            return decode(
              yield* db
                .update(table)
                .set({
                  data: sql`jsonb_set(${table.data}, '{broadcastAttempted}', 'true'::jsonb)`,
                })
                .where(and(leased(input), eq(table.status, "signed")))
                .returning(),
            );
          },
          mapRepositoryError,
        ),
        blockSubmission: Effect.fn("database.walletOperation.blockSubmission")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({
                data: sql`jsonb_set(${table.data}, '{submissionBlocked}', 'true'::jsonb)`,
              })
              .where(and(leased(input), inArray(table.status, ["signed", "submitted"])))
              .returning(),
          );
        }, mapRepositoryError),
        rejectSubmission: Effect.fn("database.walletOperation.rejectSubmission")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({
                status: "failed",
                finishedAt: date(input.now),
                leaseToken: null,
                leaseExpiresAt: null,
              })
              .where(and(leased(input), inArray(table.status, ["signed", "submitted"])))
              .returning(),
          );
        }, mapRepositoryError),
        finishReceipt: Effect.fn("database.walletOperation.finishReceipt")(function* (input) {
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
        claimForReconciliation: Effect.fn("database.walletOperation.claimForReconciliation")(
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
              .orderBy(
                sql`${table.leaseExpiresAt} ASC NULLS FIRST`,
                asc(table.createdAt),
                asc(table.id),
              )
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
        releaseLease: Effect.fn("database.walletOperation.releaseLease")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({
                leaseToken: null,
                leaseExpiresAt: date(input.nextReconcileAt),
                ...(input.reconciliation === undefined
                  ? {}
                  : {
                      data: sql`jsonb_set(${table.data}, '{reconciliation}', ${JSON.stringify(input.reconciliation)}::jsonb)`,
                    }),
              })
              .where(and(leased(input), inArray(table.status, ["signed", "submitted"])))
              .returning(),
          );
        }, mapRepositoryError),
        expireAwaitingSignatures: Effect.fn("database.walletOperation.expireAwaitingSignatures")(
          function* (input) {
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
                .set({
                  status: "expired",
                  finishedAt: date(input.now),
                  leaseToken: null,
                  leaseExpiresAt: null,
                })
                .where(inArray(table.id, due))
                .returning(),
            );
          },
          mapRepositoryError,
        ),
      });
    }),
  );
}
