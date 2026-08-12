import { DateTime, Effect } from "effect";

import { Repository, type NotificationInboxItem } from "@namera-ai/database";
import type { NotificationId, UserId } from "@namera-ai/protocol";

import { notificationPageSize } from "./data.js";

export interface NotificationInboxApplication {
  readonly list: (input: {
    readonly userId: UserId;
    readonly cursor?: NotificationId;
  }) => Effect.Effect<{
    readonly items: ReadonlyArray<NotificationInboxItem>;
    readonly nextCursor: NotificationId | null;
  }>;
  readonly unreadCount: (userId: UserId) => Effect.Effect<number>;
  readonly markRead: (notificationId: NotificationId, userId: UserId) => Effect.Effect<void>;
  readonly markAllRead: (userId: UserId) => Effect.Effect<number>;
  readonly archive: (notificationId: NotificationId, userId: UserId) => Effect.Effect<void>;
}

export const makeNotificationInboxApplication = Effect.gen(function* () {
  const repository = yield* Repository;

  const list = Effect.fn("Application.notification.list")(
    function* (input: { readonly userId: UserId; readonly cursor?: NotificationId }) {
      const rows = yield* repository.notification.inbox.listForUser({
        ...input,
        limit: notificationPageSize + 1,
        now: yield* DateTime.now,
      });
      const items = rows.slice(0, notificationPageSize);
      return {
        items,
        nextCursor:
          rows.length > notificationPageSize ? (items.at(-1)?.notification.id ?? null) : null,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const unreadCount = Effect.fn("Application.notification.unreadCount")(
    function* (userId: UserId) {
      return yield* repository.notification.inbox.countUnread({
        userId,
        now: yield* DateTime.now,
      });
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const markRead = Effect.fn("Application.notification.markRead")(
    function* (notificationId: NotificationId, userId: UserId) {
      yield* repository.notification.inbox.markRead({
        notificationId,
        userId,
        readAt: yield* DateTime.now,
      });
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const markAllRead = Effect.fn("Application.notification.markAllRead")(
    function* (userId: UserId) {
      return yield* repository.notification.inbox.markAllRead({
        userId,
        readAt: yield* DateTime.now,
      });
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const archive = Effect.fn("Application.notification.archive")(
    function* (notificationId: NotificationId, userId: UserId) {
      yield* repository.notification.inbox.archive({
        notificationId,
        userId,
        archivedAt: yield* DateTime.now,
      });
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return {
    list,
    unreadCount,
    markRead,
    markAllRead,
    archive,
  } satisfies NotificationInboxApplication;
});
