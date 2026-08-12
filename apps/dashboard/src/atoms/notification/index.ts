import type { NotificationId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const notificationsAtom = (cursor?: NotificationId) =>
  NameraClient.query("notification", "list", {
    query: cursor === undefined ? {} : { cursor },
    reactivityKeys: [...QueryKeys.notification.all, ...QueryKeys.notification.lists],
    timeToLive: "30 seconds",
  });

export const unreadNotificationCountAtom = NameraClient.query("notification", "unreadCount", {
  reactivityKeys: [...QueryKeys.notification.all, ...QueryKeys.notification.unreadCount],
  timeToLive: "30 seconds",
});

export const notificationPreferencesAtom = NameraClient.query("notification", "listPreferences", {
  reactivityKeys: [...QueryKeys.notification.all, ...QueryKeys.notification.preferences],
  timeToLive: "30 seconds",
});

export const markNotificationReadMutation = NameraClient.mutation("notification", "markRead");
export const markAllNotificationsReadMutation = NameraClient.mutation(
  "notification",
  "markAllRead",
);
export const archiveNotificationMutation = NameraClient.mutation("notification", "archive");
export const updateNotificationPreferenceMutation = NameraClient.mutation(
  "notification",
  "updatePreference",
);
export const resetNotificationPreferenceMutation = NameraClient.mutation(
  "notification",
  "resetPreference",
);
