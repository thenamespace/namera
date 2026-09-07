import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type {
  DatabaseError,
  OrganizationId,
  SessionKeyId,
  SessionKeyInstallationId,
  TransactionHash,
  UserOperationHash,
} from "@namera-ai/protocol";
import { SessionKeyInstallation, SessionKeyInstallationInsert } from "@namera-ai/protocol/model";
import { and, asc, eq, isNull } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { sessionKeyInstallation as table } from "#/schema/index";

type Scope = { readonly id: SessionKeyInstallationId; readonly organizationId: OrganizationId };
type Submission = Scope & { readonly userOperationHash: UserOperationHash };
type Confirmation = Submission & {
  readonly transactionHash: TransactionHash;
  readonly confirmedAt: DateTime.Utc;
};
type Result = Effect.Effect<SessionKeyInstallation | undefined, DatabaseError>;

export interface SessionKeyInstallationRepositoryService {
  readonly insert: (
    input: SessionKeyInstallationInsert,
  ) => Effect.Effect<SessionKeyInstallation, DatabaseError>;
  readonly findById: (scope: Scope) => Result;
  readonly findForSession: (
    organizationId: OrganizationId,
    sessionKeyId: SessionKeyId,
  ) => Effect.Effect<ReadonlyArray<SessionKeyInstallation>, DatabaseError>;
  readonly markSubmitted: (input: Submission) => Result;
  readonly markInstalled: (input: Confirmation) => Result;
  readonly beginRevocation: (scope: Scope) => Result;
  readonly markRevocationSubmitted: (input: Submission) => Result;
  readonly markRevoked: (input: Confirmation) => Result;
}

const scoped = (scope: Scope) =>
  and(eq(table.id, scope.id), eq(table.organizationId, scope.organizationId));
const decode = (rows: ReadonlyArray<typeof table.$inferSelect>) =>
  rows[0] === undefined ? undefined : Schema.decodeSync(SessionKeyInstallation)(rows[0]);

export class SessionKeyInstallationRepository extends Context.Service<
  SessionKeyInstallationRepository,
  SessionKeyInstallationRepositoryService
>()("@namera-ai/database/SessionKeyInstallationRepository") {
  static readonly layer = Layer.effect(
    SessionKeyInstallationRepository,
    Effect.gen(function* () {
      const database = yield* Database;
      return SessionKeyInstallationRepository.of({
        insert: Effect.fn("database.sessionKeyInstallation.insert")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .insert(table)
            .values({
              ...Schema.encodeSync(SessionKeyInstallationInsert)(input),
              id: input.id,
              organizationId: input.organizationId,
              sessionKeyId: input.sessionKeyId,
              walletId: input.walletId,
            })
            .returning();
          return Schema.decodeUnknownSync(SessionKeyInstallation)(rows[0]);
        }, mapRepositoryError),
        findById: Effect.fn("database.sessionKeyInstallation.findById")(function* (scope) {
          const db = yield* transactionOrDatabase(database);
          return decode(yield* db.select().from(table).where(scoped(scope)).limit(1));
        }, mapRepositoryError),
        findForSession: Effect.fn("database.sessionKeyInstallation.findForSession")(function* (
          organizationId,
          sessionKeyId,
        ) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select()
            .from(table)
            .where(
              and(eq(table.organizationId, organizationId), eq(table.sessionKeyId, sessionKeyId)),
            )
            .orderBy(asc(table.chainId));
          return rows.map((row) => Schema.decodeSync(SessionKeyInstallation)(row));
        }, mapRepositoryError),
        markSubmitted: Effect.fn("database.sessionKeyInstallation.markSubmitted")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({ status: "submitted", installUserOperationHash: input.userOperationHash })
              .where(
                and(
                  scoped(input),
                  eq(table.status, "pending"),
                  isNull(table.installUserOperationHash),
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
        markInstalled: Effect.fn("database.sessionKeyInstallation.markInstalled")(function* (
          input,
        ) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({
                status: "installed",
                installTransactionHash: input.transactionHash,
                installedAt: Schema.encodeSync(Schema.DateTimeUtcFromDate)(input.confirmedAt),
              })
              .where(
                and(
                  scoped(input),
                  eq(table.status, "submitted"),
                  eq(table.installUserOperationHash, input.userOperationHash),
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
        beginRevocation: Effect.fn("database.sessionKeyInstallation.beginRevocation")(function* (
          scope,
        ) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({ status: "revoking" })
              .where(and(scoped(scope), eq(table.status, "installed")))
              .returning(),
          );
        }, mapRepositoryError),
        markRevocationSubmitted: Effect.fn(
          "database.sessionKeyInstallation.markRevocationSubmitted",
        )(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({ uninstallUserOperationHash: input.userOperationHash })
              .where(
                and(
                  scoped(input),
                  eq(table.status, "revoking"),
                  isNull(table.uninstallUserOperationHash),
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
        markRevoked: Effect.fn("database.sessionKeyInstallation.markRevoked")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          return decode(
            yield* db
              .update(table)
              .set({
                status: "revoked",
                uninstallTransactionHash: input.transactionHash,
                revokedAt: Schema.encodeSync(Schema.DateTimeUtcFromDate)(input.confirmedAt),
              })
              .where(
                and(
                  scoped(input),
                  eq(table.status, "revoking"),
                  eq(table.uninstallUserOperationHash, input.userOperationHash),
                ),
              )
              .returning(),
          );
        }, mapRepositoryError),
      });
    }),
  );
}
