import { Metric } from "effect";

export const notificationsCreated = Metric.counter("namera.notification.created", {
  description: "Number of notification records created",
  incremental: true,
});

export const notificationRecipientsAdded = Metric.counter("namera.notification.recipients.added", {
  description: "Number of in-app notification recipients added",
  incremental: true,
});

export const notificationPreferenceChanges = Metric.counter(
  "namera.notification.preferences.changed",
  {
    description: "Number of notification preference changes",
    incremental: true,
  },
);
