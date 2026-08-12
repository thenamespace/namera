import { Schema } from "effect";

export const NotificationCategory = Schema.Literals([
  "security",
  "organization",
  "wallet",
  "billing",
  "product",
]);

export const NotificationChannel = Schema.Literals(["in-app", "email"]);

export type NotificationCategory = typeof NotificationCategory.Type;
export type NotificationChannel = typeof NotificationChannel.Type;
