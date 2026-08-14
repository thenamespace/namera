// oxlint-disable typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError, UserId } from "@namera-ai/protocol";
import {
  NotificationPreference,
  NotificationPreferenceInsert,
  type NotificationPreferenceScope,
} from "@namera-ai/protocol/model";
import { and, eq, isNull, sql } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { notificationPreference } from "#/schema/index";

export interface NotificationPreferenceRepositoryService {
  readonly listForUser: (
    userId: UserId,
  ) => Effect.Effect<ReadonlyArray<NotificationPreference>, DatabaseError>;
  readonly findForScope: (
    input: NotificationPreferenceScope,
  ) => Effect.Effect<NotificationPreference | undefined, DatabaseError>;
  readonly upsert: (
    input: NotificationPreferenceInsert,
  ) => Effect.Effect<NotificationPreference, DatabaseError>;
  readonly remove: (
    input: NotificationPreferenceScope,
  ) => Effect.Effect<NotificationPreference | undefined, DatabaseError>;
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
          listForUser: Effect.fn("database.notificationPreferenceRepository.listForUser")(
            function* (userId) {
              const db = yield* transactionOrDatabase(database);
              const rows = yield* db.query.notificationPreference.findMany({
                where: { userId: { eq: userId } },
              });
              return Schema.decodeUnknownSync(Schema.Array(NotificationPreference))(rows);
            },
            mapRepositoryError,
          ),
          findForScope: Effect.fn("database.notificationPreferenceRepository.findForScope")(
            function* (input) {
              const db = yield* transactionOrDatabase(database);
              const row = yield* db.query.notificationPreference.findFirst({
                where: {
                  userId: { eq: input.userId },
                  organizationId:
                    input.organizationId === null ? { isNull: true } : { eq: input.organizationId },
                  category: { eq: input.category },
                  topic: { eq: input.topic },
                  channel: { eq: input.channel },
                },
              });
              return row ? Schema.decodeUnknownSync(NotificationPreference)(row) : undefined;
            },
            mapRepositoryError,
          ),
          upsert: Effect.fn("database.notificationPreferenceRepository.upsert")(function* (input) {
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
                      notificationPreference.topic,
                      notificationPreference.channel,
                    ]
                  : [
                      notificationPreference.userId,
                      notificationPreference.organizationId,
                      notificationPreference.category,
                      notificationPreference.topic,
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
            return Schema.decodeUnknownSync(NotificationPreference)(preference);
          }, mapRepositoryError),
          remove: Effect.fn("database.notificationPreferenceRepository.remove")(function* (input) {
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
                  eq(notificationPreference.topic, input.topic),
                  eq(notificationPreference.channel, input.channel),
                ),
              )
              .returning();
            return rows[0] ? Schema.decodeUnknownSync(NotificationPreference)(rows[0]) : undefined;
          }, mapRepositoryError),
        });
      }),
    );
}
