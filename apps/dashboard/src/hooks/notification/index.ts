import {
  archiveNotificationMutation,
  markAllNotificationsReadMutation,
  markNotificationReadMutation,
  notificationPreferencesAtom,
  notificationsAtom,
  resetNotificationPreferenceMutation,
  unreadNotificationCountAtom,
  updateNotificationPreferenceMutation,
} from "@/atoms/notification";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useNotifications = toQuery(notificationsAtom);
export const useUnreadNotificationCount = toQuery(() => unreadNotificationCountAtom);
export const useNotificationPreferences = toQuery(() => notificationPreferencesAtom);

const inboxKeys = [...QueryKeys.notification.lists, ...QueryKeys.notification.unreadCount];

export const useMarkNotificationRead = toMutation(markNotificationReadMutation, {
  invalidates: inboxKeys,
});

export const useMarkAllNotificationsRead = toMutation(markAllNotificationsReadMutation, {
  invalidates: inboxKeys,
});

export const useArchiveNotification = toMutation(archiveNotificationMutation, {
  invalidates: inboxKeys,
});

export const useUpdateNotificationPreference = toMutation(updateNotificationPreferenceMutation, {
  invalidates: QueryKeys.notification.preferences,
});

export const useResetNotificationPreference = toMutation(resetNotificationPreferenceMutation, {
  invalidates: QueryKeys.notification.preferences,
});
