import { Context, DateTime, Effect, Layer, Schema } from "effect";

import type { Email, UserId } from "@namera-ai/protocol";
import {
  PlatformMember,
  PlatformMemberView,
  PlatformInvitation,
  PlatformEventData,
} from "@namera-ai/protocol/model";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { platformMember, platformInvitation, platformEvent, user } from "#/schema/index";

const member = (rows: unknown[]) =>
  rows[0] ? Schema.decodeUnknownSync(PlatformMember)(rows[0]) : undefined;
const invitation = (rows: unknown[]) =>
  rows[0] ? Schema.decodeUnknownSync(PlatformInvitation)(rows[0]) : undefined;

const make = Effect.gen(function* () {
  const database = yield* Database;
  return {
    // Low-volume team mutations serialize across replicas, including the empty
    // initial team. Call only inside TransactionService.run.
    lockTeam: Effect.fn("database.platform.lockTeam")(function* () {
      const db = yield* transactionOrDatabase(database);
      yield* db
        .select({ lock: sql`pg_advisory_xact_lock(719204, 1)` })
        .from(sql`(select 1) as team_lock`);
    }, mapRepositoryError),
    findMember: Effect.fn("database.platform.findMember")(function* (userId: UserId) {
      const db = yield* transactionOrDatabase(database);
      return member(
        yield* db.select().from(platformMember).where(eq(platformMember.userId, userId)),
      );
    }, mapRepositoryError),
    findById: Effect.fn("database.platform.findById")(function* (id: string) {
      const db = yield* transactionOrDatabase(database);
      return member(yield* db.select().from(platformMember).where(eq(platformMember.id, id)));
    }, mapRepositoryError),
    findOwner: Effect.fn("database.platform.findOwner")(function* () {
      const db = yield* transactionOrDatabase(database);
      return member(
        yield* db.select().from(platformMember).where(eq(platformMember.role, "owner")),
      );
    }, mapRepositoryError),
    listMembers: Effect.fn("database.platform.listMembers")(function* () {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .select({
          id: platformMember.id,
          userId: platformMember.userId,
          role: platformMember.role,
          status: platformMember.status,
          createdAt: platformMember.createdAt,
          updatedAt: platformMember.updatedAt,
          email: user.email,
          metadata: user.metadata,
        })
        .from(platformMember)
        .innerJoin(user, eq(user.id, platformMember.userId))
        .orderBy(desc(platformMember.id));
      return Schema.decodeUnknownSync(Schema.Array(PlatformMemberView))(rows);
    }, mapRepositoryError),
    createMember: Effect.fn("database.platform.createMember")(function* (input: {
      userId: UserId;
      role: PlatformMember["role"];
    }) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db.insert(platformMember).values(input).returning();
      return Schema.decodeUnknownSync(PlatformMember)(rows[0]);
    }, mapRepositoryError),
    changeMember: Effect.fn("database.platform.changeMember")(function* (
      id: string,
      input: { role?: PlatformMember["role"]; status?: PlatformMember["status"] },
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      return member(
        yield* db
          .update(platformMember)
          .set({ ...input, updatedAt: DateTime.toDateUtc(now) })
          .where(eq(platformMember.id, id))
          .returning(),
      );
    }, mapRepositoryError),
    pendingForEmail: Effect.fn("database.platform.pendingForEmail")(function* (
      email: Email,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .select({ invitation: platformInvitation })
        .from(platformInvitation)
        .innerJoin(platformMember, eq(platformMember.id, platformInvitation.invitedByMemberId))
        .where(
          and(
            eq(platformInvitation.email, email),
            eq(platformMember.role, "owner"),
            eq(platformMember.status, "active"),
            isNull(platformInvitation.acceptedAt),
            isNull(platformInvitation.revokedAt),
            gt(platformInvitation.expiresAt, DateTime.toDateUtc(now)),
          ),
        );
      return invitation(rows.map((row) => row.invitation));
    }, mapRepositoryError),
    findInvitationByHash: Effect.fn("database.platform.findInvitationByHash")(function* (
      hash: string,
    ) {
      const db = yield* transactionOrDatabase(database);
      return invitation(
        yield* db.select().from(platformInvitation).where(eq(platformInvitation.tokenHash, hash)),
      );
    }, mapRepositoryError),
    listInvitations: Effect.fn("database.platform.listInvitations")(function* (
      cursor: string | undefined,
    ) {
      const db = yield* transactionOrDatabase(database);
      const rows = yield* db
        .select()
        .from(platformInvitation)
        .where(cursor ? sql`${platformInvitation.id} < ${cursor}` : undefined)
        .orderBy(desc(platformInvitation.id))
        .limit(100);
      return Schema.decodeUnknownSync(Schema.Array(PlatformInvitation))(rows);
    }, mapRepositoryError),
    retireInvitations: Effect.fn("database.platform.retireInvitations")(function* (
      email: Email,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      return Schema.decodeUnknownSync(Schema.Array(PlatformInvitation))(
        yield* db
          .update(platformInvitation)
          .set({ revokedAt: DateTime.toDateUtc(now) })
          .where(
            and(
              eq(platformInvitation.email, email),
              isNull(platformInvitation.acceptedAt),
              isNull(platformInvitation.revokedAt),
            ),
          )
          .returning(),
      );
    }, mapRepositoryError),
    createInvitation: Effect.fn("database.platform.createInvitation")(function* (input: {
      email: Email;
      role: PlatformInvitation["role"];
      invitedByMemberId: string;
      tokenHash: string;
      createdAt: DateTime.Utc;
      expiresAt: DateTime.Utc;
    }) {
      const db = yield* transactionOrDatabase(database);
      return Schema.decodeUnknownSync(PlatformInvitation)(
        (yield* db
          .insert(platformInvitation)
          .values({
            ...input,
            createdAt: DateTime.toDateUtc(input.createdAt),
            expiresAt: DateTime.toDateUtc(input.expiresAt),
          })
          .returning())[0],
      );
    }, mapRepositoryError),
    revokeInvitation: Effect.fn("database.platform.revokeInvitation")(function* (
      id: string,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      return invitation(
        yield* db
          .update(platformInvitation)
          .set({ revokedAt: DateTime.toDateUtc(now) })
          .where(
            and(
              eq(platformInvitation.id, id),
              isNull(platformInvitation.acceptedAt),
              isNull(platformInvitation.revokedAt),
            ),
          )
          .returning(),
      );
    }, mapRepositoryError),
    acceptInvitation: Effect.fn("database.platform.acceptInvitation")(function* (
      id: string,
      userId: UserId,
      now: DateTime.Utc,
    ) {
      const db = yield* transactionOrDatabase(database);
      return invitation(
        yield* db
          .update(platformInvitation)
          .set({ acceptedAt: DateTime.toDateUtc(now), acceptedByUserId: userId })
          .where(
            and(
              eq(platformInvitation.id, id),
              isNull(platformInvitation.acceptedAt),
              isNull(platformInvitation.revokedAt),
              gt(platformInvitation.expiresAt, DateTime.toDateUtc(now)),
            ),
          )
          .returning(),
      );
    }, mapRepositoryError),
    appendEvent: Effect.fn("database.platform.appendEvent")(function* (
      actorMemberId: string | null,
      data: PlatformEventData,
    ) {
      const db = yield* transactionOrDatabase(database);
      yield* db
        .insert(platformEvent)
        .values({ actorMemberId, data: Schema.decodeUnknownSync(PlatformEventData)(data) });
    }, mapRepositoryError),
  };
});

export class PlatformRepository extends Context.Service<
  PlatformRepository,
  Effect.Success<typeof make>
>()("@namera-ai/database/PlatformRepository") {
  static readonly layer = Layer.effect(PlatformRepository, make);
}
