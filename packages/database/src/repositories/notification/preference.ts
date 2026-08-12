// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, OrganizationId, UserId } from "@namera-ai/protocol";
import {
  NotificationPreference,
  NotificationPreferenceInsert,
  type NotificationCategory,
  type NotificationChannel,
} from "@namera-ai/protocol/model";
import { and, eq, isNull, sql } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { notificationPreference } from "#/schema/index";

export interface NotificationPreferenceRepositoryService {
  readonly listForUser: (
    userId: UserId,
  ) => Effect.Effect<ReadonlyArray<NotificationPreference>, DatabaseError>;
  readonly findForScope: (input: {
    readonly userId: UserId;
    readonly organizationId: OrganizationId | null;
    readonly category: NotificationCategory;
    readonly channel: NotificationChannel;
  }) => Effect.Effect<NotificationPreference | undefined, DatabaseError>;
  readonly upsert: (
    input: NotificationPreferenceInsert,
  ) => Effect.Effect<NotificationPreference, DatabaseError>;
  readonly remove: (input: {
    readonly userId: UserId;
    readonly organizationId: OrganizationId | null;
    readonly category: NotificationCategory;
    readonly channel: NotificationChannel;
  }) => Effect.Effect<NotificationPreference | undefined, DatabaseError>;
}

export class NotificationPreferenceRepository extends Context.Service<
  NotificationPreferenceRepository,
  NotificationPreferenceRepositoryService
>()("@namera-ai/database/NotificationPreferenceRepository") {
  static readonly layer: Layer.Layer<NotificationPreferenceRepository, never, Database> =
    Layer.effect(
      NotificationPreferenceRepository,
      Effect.gen(function* () {
        const database = yield* Database;

        return NotificationPreferenceRepository.of({
          listForUser: Effect.fn("NotificationPreferenceRepository.listForUser")(function* (
            userId,
          ) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db.query.notificationPreference.findMany({
              where: { userId: { eq: userId } },
            });
            return Schema.decodeSync(Schema.Array(NotificationPreference))(rows);
          }, mapToDatabaseError),
          findForScope: Effect.fn("NotificationPreferenceRepository.findForScope")(function* (
            input,
          ) {
            const db = yield* transactionOrDatabase(database);
            const row = yield* db.query.notificationPreference.findFirst({
              where: {
                userId: { eq: input.userId },
                organizationId:
                  input.organizationId === null ? { isNull: true } : { eq: input.organizationId },
                category: { eq: input.category },
                channel: { eq: input.channel },
              },
            });
            return row ? Schema.decodeSync(NotificationPreference)(row) : undefined;
          }, mapToDatabaseError),
          upsert: Effect.fn("NotificationPreferenceRepository.upsert")(function* (input) {
            const db = yield* transactionOrDatabase(database);
            const encoded = Schema.encodeSync(NotificationPreferenceInsert)(input);
            const global = input.organizationId === null;
            const rows = yield* db
              .insert(notificationPreference)
              .values(encoded as typeof notificationPreference.$inferInsert)
              .onConflictDoUpdate({
                target: global
                  ? [
                      notificationPreference.userId,
                      notificationPreference.category,
                      notificationPreference.channel,
                    ]
                  : [
                      notificationPreference.userId,
                      notificationPreference.organizationId,
                      notificationPreference.category,
                      notificationPreference.channel,
                    ],
                targetWhere: global
                  ? sql`${notificationPreference.organizationId} IS NULL`
                  : sql`${notificationPreference.organizationId} IS NOT NULL`,
                set: { enabled: input.enabled },
              })
              .returning();
            const preference = rows[0];
            if (preference === undefined) {
              return yield* Effect.die("Notification preference upsert returned no row");
            }
            return Schema.decodeSync(NotificationPreference)(preference);
          }, mapToDatabaseError),
          remove: Effect.fn("NotificationPreferenceRepository.remove")(function* (input) {
            const db = yield* transactionOrDatabase(database);
            const rows = yield* db
              .delete(notificationPreference)
              .where(
                and(
                  eq(notificationPreference.userId, input.userId),
                  input.organizationId === null
                    ? isNull(notificationPreference.organizationId)
                    : eq(notificationPreference.organizationId, input.organizationId),
                  eq(notificationPreference.category, input.category),
                  eq(notificationPreference.channel, input.channel),
                ),
              )
              .returning();
            return rows[0] ? Schema.decodeSync(NotificationPreference)(rows[0]) : undefined;
          }, mapToDatabaseError),
        });
      }),
    );
}
