import { Effect, Schema, Struct } from "effect";

import { UserId, UserPreferencesId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/database/helpers";

import { TimestampFields } from "../common";

const OptionalBooleanWithDefault = (defaultValue: boolean) =>
  Schema.Boolean.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(Effect.succeed(defaultValue)),
  );

const ProductNotifications = Schema.Struct({
  announcements: OptionalBooleanWithDefault(true),
  changelog: OptionalBooleanWithDefault(false),
  newsletter: OptionalBooleanWithDefault(true),
}).pipe(
  Schema.withDecodingDefault(
    Effect.succeed({
      announcements: true,
      changelog: false,
      newsletter: true,
    }),
  ),
);

const AccountNotifications = Schema.Struct({
  activity: OptionalBooleanWithDefault(true),
  security: OptionalBooleanWithDefault(true),
}).pipe(
  Schema.withDecodingDefault(
    Effect.succeed({
      activity: true,
      security: true,
    }),
  ),
);

const TransactionNotifications = Schema.Struct({
  smartAccount: OptionalBooleanWithDefault(true),
  sessionKey: OptionalBooleanWithDefault(true),
}).pipe(
  Schema.withDecodingDefault(
    Effect.succeed({
      smartAccount: true,
      sessionKey: true,
    }),
  ),
);

export const NotificationPreferences = Schema.Struct({
  product: Schema.optionalKey(ProductNotifications),
  account: Schema.optionalKey(AccountNotifications),
  transaction: Schema.optionalKey(TransactionNotifications),
});

export const UserPreferenceMetadata = Schema.Json;

export const UserPreference = Schema.Struct({
  id: UserPreferencesId,
  userId: UserId,
  notificationPreferences: NotificationPreferences,
  metadata: UserPreferenceMetadata,
}).mapFields(Struct.assign(TimestampFields));

export const UserPreferenceUpdate = createUpdateSchema(UserPreference);
export const UserPreferenceInsert = createInsertSchema(
  UserPreference,
  "userId",
  "notificationPreferences",
  "metadata",
);

export type NotificationPreferences = typeof NotificationPreferences.Type;
export type UserPreferenceMetadata = typeof UserPreferenceMetadata.Type;

export type UserPreference = typeof UserPreference.Type;
export type UserPreferenceUpdate = typeof UserPreferenceUpdate.Type;
export type UserPreferenceInsert = typeof UserPreferenceInsert.Type;
