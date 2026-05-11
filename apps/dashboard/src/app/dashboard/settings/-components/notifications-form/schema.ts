import { Schema } from "effect";

export const NotificationsFormSchema = Schema.Struct({
  product: Schema.Struct({
    announcements: Schema.Boolean,
    changelog: Schema.Boolean,
    newsletter: Schema.Boolean,
  }),
  account: Schema.Struct({
    activity: Schema.Boolean,
    security: Schema.Boolean,
  }),
  transaction: Schema.Struct({
    smartAccount: Schema.Boolean,
    sessionKey: Schema.Boolean,
  }),
});

export type NotificationsFormSchema = typeof NotificationsFormSchema.Type;
