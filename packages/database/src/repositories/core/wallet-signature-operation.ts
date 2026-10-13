import { Context, DateTime, Effect, Layer, Schema } from "effect";

import {
  DatabaseError,
  type ActorId,
  type OrganizationId,
  type SignatureOperationId,
} from "@namera-ai/protocol";
import {
  WalletSignatureOperation,
  WalletSignatureOperationInsert,
} from "@namera-ai/protocol/model";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { walletSignatureOperation as table } from "#/schema/index";

type Scope = { readonly organizationId: OrganizationId; readonly actorId: ActorId };
type OperationScope = Scope & { readonly id: SignatureOperationId };
const decode = (row: unknown) =>
  row === undefined ? undefined : Schema.decodeUnknownSync(WalletSignatureOperation)(row);
const scoped = (input: OperationScope) =>
  and(
    eq(table.id, input.id),
    eq(table.organizationId, input.organizationId),
    eq(table.actorId, input.actorId),
  );
const make = Effect.gen(function* () {
  const database = yield* Database;
  return {
    findById: Effect.fn("database.walletSignatureOperation.findById")(
      function* (input: OperationScope) {
        const db = yield* transactionOrDatabase(database);
        return decode((yield* db.select().from(table).where(scoped(input)).limit(1))[0]);
      },
      mapRepositoryError,
      Effect.mapError(
        () => new DatabaseError({ cause: new Error("Wallet signature persistence failed") }),
      ),
    ),
    findByIdempotencyKey: Effect.fn("database.walletSignatureOperation.findByIdempotencyKey")(
      function* (input: Scope & { readonly idempotencyKey: string }) {
        const db = yield* transactionOrDatabase(database);
        return decode(
          (yield* db
            .select()
            .from(table)
            .where(
              and(
                eq(table.organizationId, input.organizationId),
                eq(table.actorId, input.actorId),
                eq(table.idempotencyKey, input.idempotencyKey),
              ),
            )
            .limit(1))[0],
        );
      },
      mapRepositoryError,
      Effect.mapError(
        () => new DatabaseError({ cause: new Error("Wallet signature persistence failed") }),
      ),
    ),
    insert: Effect.fn("database.walletSignatureOperation.insert")(
      function* (input: WalletSignatureOperationInsert) {
        const db = yield* transactionOrDatabase(database);
        const rows = yield* db
          .insert(table)
          .values({
            ...Schema.encodeSync(WalletSignatureOperationInsert)(input),
            id: input.id,
            organizationId: input.organizationId,
            actorId: input.actorId,
            walletId: input.walletId,
            signingKeyId: input.signingKeyId,
            request: input.request,
          })
          .onConflictDoNothing()
          .returning();
        return decode(rows[0]);
      },
      mapRepositoryError,
      Effect.mapError(
        () => new DatabaseError({ cause: new Error("Wallet signature persistence failed") }),
      ),
    ),
    claim: Effect.fn("database.walletSignatureOperation.claim")(
      function* (
        input: OperationScope & {
          readonly leaseToken: string;
          readonly now: DateTime.Utc;
          readonly leaseExpiresAt: DateTime.Utc;
        },
      ) {
        const db = yield* transactionOrDatabase(database);
        return decode(
          (yield* db
            .update(table)
            .set({
              leaseToken: input.leaseToken,
              leaseExpiresAt: DateTime.toDateUtc(input.leaseExpiresAt),
            })
            .where(
              and(
                scoped(input),
                eq(table.status, "prepared"),
                gt(table.expiresAt, DateTime.toDateUtc(input.now)),
                or(
                  isNull(table.leaseExpiresAt),
                  lte(table.leaseExpiresAt, DateTime.toDateUtc(input.now)),
                ),
              ),
            )
            .returning())[0],
        );
      },
      mapRepositoryError,
      Effect.mapError(
        () => new DatabaseError({ cause: new Error("Wallet signature persistence failed") }),
      ),
    ),
    release: Effect.fn("database.walletSignatureOperation.release")(
      function* (input: OperationScope & { readonly leaseToken: string }) {
        const db = yield* transactionOrDatabase(database);
        yield* db
          .update(table)
          .set({ leaseToken: null, leaseExpiresAt: null })
          .where(
            and(
              scoped(input),
              eq(table.leaseToken, input.leaseToken),
              eq(table.status, "prepared"),
            ),
          );
      },
      mapRepositoryError,
      Effect.mapError(
        () => new DatabaseError({ cause: new Error("Wallet signature persistence failed") }),
      ),
    ),
    succeed: Effect.fn("database.walletSignatureOperation.succeed")(
      function* (
        input: OperationScope & {
          readonly leaseToken: string;
          readonly now: DateTime.Utc;
          readonly encryptedResult: string;
        },
      ) {
        const db = yield* transactionOrDatabase(database);
        return decode(
          (yield* db
            .update(table)
            .set({
              status: "succeeded",
              encryptedResult: input.encryptedResult,
              succeededAt: DateTime.toDateUtc(input.now),
              leaseToken: null,
              leaseExpiresAt: null,
            })
            .where(
              and(
                scoped(input),
                eq(table.status, "prepared"),
                eq(table.leaseToken, input.leaseToken),
                gt(table.leaseExpiresAt, DateTime.toDateUtc(input.now)),
                gt(table.expiresAt, DateTime.toDateUtc(input.now)),
              ),
            )
            .returning())[0],
        );
      },
      mapRepositoryError,
      Effect.mapError(
        () => new DatabaseError({ cause: new Error("Wallet signature persistence failed") }),
      ),
    ),
  };
});

export class WalletSignatureOperationRepository extends Context.Service<
  WalletSignatureOperationRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/WalletSignatureOperationRepository") {
  static readonly layer = Layer.effect(WalletSignatureOperationRepository, make);
}
