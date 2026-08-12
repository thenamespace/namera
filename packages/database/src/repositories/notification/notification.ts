// oxlint-disable typescript/no-explicit-any typescript/no-non-null-assertion
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError, NotificationId, UserId } from "@namera-ai/protocol";
import {
  Notification,
  NotificationInsert,
  NotificationRecipient,
  NotificationRecipientInsert,
  type Notification as NotificationModel,
  type NotificationRecipient as NotificationRecipientModel,
  type NotificationType,
} from "@namera-ai/protocol/model";
import { and, count, desc, eq, gt, isNull, lt, or } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { notification, notificationRecipient } from "#/schema/index";

export interface NotificationInboxItem {
  readonly notification: Notification;
  readonly recipient: NotificationRecipientModel;
}

export interface NotificationRepositoryService {
  readonly create: (
    data: NotificationInsert,
  ) => Effect.Effect<
    { readonly notification: Notification; readonly inserted: boolean },
    DatabaseError
  >;
  readonly addRecipient: (
    data: NotificationRecipientInsert,
  ) => Effect.Effect<
    { readonly recipient: NotificationRecipientModel; readonly inserted: boolean },
    DatabaseError
  >;
  readonly listForUser: (input: {
    readonly userId: UserId;
    readonly cursor?: NotificationId;
    readonly limit: number;
    readonly now: DateTime.Utc;
  }) => Effect.Effect<ReadonlyArray<NotificationInboxItem>, DatabaseError>;
  readonly countUnread: (input: {
    readonly userId: UserId;
    readonly now: DateTime.Utc;
  }) => Effect.Effect<number, DatabaseError>;
  readonly markRead: (input: {
    readonly notificationId: NotificationId;
    readonly userId: UserId;
    readonly readAt: DateTime.Utc;
  }) => Effect.Effect<NotificationRecipientModel | undefined, DatabaseError>;
  readonly markAllRead: (input: {
    readonly userId: UserId;
    readonly readAt: DateTime.Utc;
  }) => Effect.Effect<number, DatabaseError>;
  readonly archive: (input: {
    readonly notificationId: NotificationId;
    readonly userId: UserId;
    readonly archivedAt: DateTime.Utc;
  }) => Effect.Effect<NotificationRecipientModel | undefined, DatabaseError>;
  readonly expireByResource: (input: {
    readonly type: NotificationType;
    readonly resourceId: NotificationModel["resourceId"];
    readonly expiresAt: DateTime.Utc;
  }) => Effect.Effect<number, DatabaseError>;
}

const encodeDate = Schema.encodeSync(Schema.DateTimeUtcFromDate);

export class NotificationRepository extends Context.Service<
  NotificationRepository,
  NotificationRepositoryService
>()("@namera-ai/database/NotificationRepository") {
  static readonly layer: Layer.Layer<NotificationRepository, never, Database> = Layer.effect(
    NotificationRepository,
    Effect.gen(function* () {
      const database = yield* Database;

      return NotificationRepository.of({
        create: Effect.fn("NotificationRepository.create")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(NotificationInsert)(data);
          const rows = yield* db
            .insert(notification)
            .values(encoded as any)
            .onConflictDoNothing({ target: notification.idempotencyKey })
            .returning();
          if (rows[0]) {
            return {
              notification: Schema.decodeSync(Notification)(rows[0] as any),
              inserted: true,
            };
          }

          const existing = yield* db.query.notification.findFirst({
            where: { idempotencyKey: { eq: data.idempotencyKey } },
          });
          return {
            notification: Schema.decodeSync(Notification)(existing! as any),
            inserted: false,
          };
        }, mapToDatabaseError),
        addRecipient: Effect.fn("NotificationRepository.addRecipient")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const encoded = Schema.encodeSync(NotificationRecipientInsert)(data);
          const rows = yield* db
            .insert(notificationRecipient)
            .values(encoded as typeof notificationRecipient.$inferInsert)
            .onConflictDoNothing({
              target: [notificationRecipient.notificationId, notificationRecipient.userId],
            })
            .returning();
          if (rows[0]) {
            return {
              recipient: Schema.decodeSync(NotificationRecipient)(rows[0]),
              inserted: true,
            };
          }

          const existing = yield* db.query.notificationRecipient.findFirst({
            where: {
              notificationId: { eq: data.notificationId },
              userId: { eq: data.userId },
            },
          });
          return {
            recipient: Schema.decodeSync(NotificationRecipient)(existing!),
            inserted: false,
          };
        }, mapToDatabaseError),
        listForUser: Effect.fn("NotificationRepository.listForUser")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const now = encodeDate(input.now);
          const cursor =
            input.cursor === undefined
              ? undefined
              : yield* db.query.notificationRecipient.findFirst({
                  where: {
                    notificationId: { eq: input.cursor },
                    userId: { eq: input.userId },
                  },
                });
          if (input.cursor !== undefined && cursor === undefined) {
            return [];
          }

          const rows = yield* db
            .select({ notification, recipient: notificationRecipient })
            .from(notificationRecipient)
            .innerJoin(notification, eq(notification.id, notificationRecipient.notificationId))
            .where(
              and(
                eq(notificationRecipient.userId, input.userId),
                isNull(notificationRecipient.archivedAt),
                or(isNull(notification.expiresAt), gt(notification.expiresAt, now)),
                cursor === undefined
                  ? undefined
                  : or(
                      lt(notificationRecipient.receivedAt, cursor.receivedAt),
                      and(
                        eq(notificationRecipient.receivedAt, cursor.receivedAt),
                        lt(notificationRecipient.notificationId, cursor.notificationId),
                      ),
                    ),
              ),
            )
            .orderBy(
              desc(notificationRecipient.receivedAt),
              desc(notificationRecipient.notificationId),
            )
            .limit(input.limit);

          return rows.map((row) => ({
            notification: Schema.decodeSync(Notification)(row.notification as any),
            recipient: Schema.decodeSync(NotificationRecipient)(row.recipient),
          }));
        }, mapToDatabaseError),
        countUnread: Effect.fn("NotificationRepository.countUnread")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .select({ value: count() })
            .from(notificationRecipient)
            .innerJoin(notification, eq(notification.id, notificationRecipient.notificationId))
            .where(
              and(
                eq(notificationRecipient.userId, input.userId),
                isNull(notificationRecipient.readAt),
                isNull(notificationRecipient.archivedAt),
                or(
                  isNull(notification.expiresAt),
                  gt(notification.expiresAt, encodeDate(input.now)),
                ),
              ),
            );
          return rows[0]?.value ?? 0;
        }, mapToDatabaseError),
        markRead: Effect.fn("NotificationRepository.markRead")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(notificationRecipient)
            .set({ readAt: encodeDate(input.readAt) })
            .where(
              and(
                eq(notificationRecipient.notificationId, input.notificationId),
                eq(notificationRecipient.userId, input.userId),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(NotificationRecipient)(rows[0]) : undefined;
        }, mapToDatabaseError),
        markAllRead: Effect.fn("NotificationRepository.markAllRead")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(notificationRecipient)
            .set({ readAt: encodeDate(input.readAt) })
            .where(
              and(
                eq(notificationRecipient.userId, input.userId),
                isNull(notificationRecipient.readAt),
                isNull(notificationRecipient.archivedAt),
              ),
            )
            .returning({ notificationId: notificationRecipient.notificationId });
          return rows.length;
        }, mapToDatabaseError),
        archive: Effect.fn("NotificationRepository.archive")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(notificationRecipient)
            .set({ archivedAt: encodeDate(input.archivedAt) })
            .where(
              and(
                eq(notificationRecipient.notificationId, input.notificationId),
                eq(notificationRecipient.userId, input.userId),
              ),
            )
            .returning();
          return rows[0] ? Schema.decodeSync(NotificationRecipient)(rows[0]) : undefined;
        }, mapToDatabaseError),
        expireByResource: Effect.fn("NotificationRepository.expireByResource")(function* (input) {
          const db = yield* transactionOrDatabase(database);
          const rows = yield* db
            .update(notification)
            .set({ expiresAt: encodeDate(input.expiresAt) })
            .where(
              and(eq(notification.type, input.type), eq(notification.resourceId, input.resourceId)),
            )
            .returning({ id: notification.id });
          return rows.length;
        }, mapToDatabaseError),
      });
    }),
  );
}
