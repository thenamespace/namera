import { Schema, Struct } from "effect";

export const NotificationCategory = Schema.Literals([
  "product",
  "account",
  "organization",
  "billing",
]);

export const NotificationChannel = Schema.Literals(["in-app", "email"]);
export const NotificationPreferenceChannel = Schema.Literal("email");

export const ProductNotificationTopic = Schema.Literals([
  "announcements",
  "changelog",
  "newsletter",
]);
export const AccountNotificationTopic = Schema.Literals(["activity", "security"]);
export const OrganizationNotificationTopic = Schema.Literals([
  "invitations",
  "wallets",
  "session-keys",
  "api-keys",
  "executions",
]);
export const BillingNotificationTopic = Schema.Literal("activity");

export const NotificationTopic = Schema.Literals([
  "announcements",
  "changelog",
  "newsletter",
  "activity",
  "security",
  "invitations",
  "wallets",
  "session-keys",
  "api-keys",
  "executions",
]);

const ProductNotificationTarget = Schema.Struct({
  category: Schema.Literal("product"),
  topic: ProductNotificationTopic,
});
const AccountNotificationTarget = Schema.Struct({
  category: Schema.Literal("account"),
  topic: AccountNotificationTopic,
});
const OrganizationNotificationTarget = Schema.Struct({
  category: Schema.Literal("organization"),
  topic: OrganizationNotificationTopic,
});
const BillingNotificationTarget = Schema.Struct({
  category: Schema.Literal("billing"),
  topic: BillingNotificationTopic,
});

export const withNotificationPreferenceTarget = <const Fields extends Schema.Struct.Fields>(
  fields: Fields,
) =>
  Schema.Union([
    ProductNotificationTarget.mapFields(Struct.assign(fields)),
    AccountNotificationTarget.mapFields(Struct.assign(fields)),
    OrganizationNotificationTarget.mapFields(Struct.assign(fields)),
    BillingNotificationTarget.mapFields(Struct.assign(fields)),
  ]);

export const NotificationPreferenceTarget = withNotificationPreferenceTarget({});

export type NotificationCategory = typeof NotificationCategory.Type;
export type NotificationChannel = typeof NotificationChannel.Type;
export type NotificationPreferenceChannel = typeof NotificationPreferenceChannel.Type;
export type NotificationTopic = typeof NotificationTopic.Type;
export type NotificationPreferenceTarget = typeof NotificationPreferenceTarget.Type;
