import { Effect, Schema } from "effect";

import { UserId, UserPreferenceId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const NotificationChannelPreferences = Schema.Struct({
  email: Schema.Boolean,
  inApp: Schema.Boolean,
  push: Schema.Boolean,
});

const OptionalBooleanWithDefault = (defaultValue: boolean) =>
  Schema.optional(Schema.Boolean).pipe(
    Schema.withDecodingDefault(Effect.succeed(defaultValue)),
  );

export const NotificationPreferences = Schema.Struct({
  product: Schema.optional(
    Schema.Struct({
      announcements: OptionalBooleanWithDefault(true),
      changelog: OptionalBooleanWithDefault(false),
      newsletter: OptionalBooleanWithDefault(true),
    }),
  ).pipe(
    Schema.withDecodingDefault(
      Effect.succeed({
        announcements: true,
        changelog: false,
        newsletter: true,
      }),
    ),
  ),
  account: Schema.optional(
    Schema.Struct({
      activity: OptionalBooleanWithDefault(true),
      security: OptionalBooleanWithDefault(true),
    }),
  ).pipe(
    Schema.withDecodingDefault(
      Effect.succeed({
        activity: true,
        security: true,
      }),
    ),
  ),
  transaction: Schema.optional(
    Schema.Struct({
      smartAccount: OptionalBooleanWithDefault(true),
      sessionKey: OptionalBooleanWithDefault(true),
    }),
  ).pipe(
    Schema.withDecodingDefault(
      Effect.succeed({
        smartAccount: true,
        sessionKey: true,
      }),
    ),
  ),
});

export const UserPreferenceMetadata = Schema.Json;

export const UserPreference = Schema.Struct({
  id: UserPreferenceId,
  userId: UserId,
  notificationPreferences: NotificationPreferences,
  metadata: UserPreferenceMetadata,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  deletedAt: Schema.NullOr(Schema.Date),
});
export const UserPreferenceUpdate = createUpdateSchema(UserPreference);
export const UserPreferenceInsert = createInsertSchema(
  UserPreference,
  "userId",
  "metadata",
  "notificationPreferences",
);

export type NotificationChannelPreferences =
  typeof NotificationChannelPreferences.Type;
export type NotificationPreferences = typeof NotificationPreferences.Type;
export type UserPreferenceMetadata = typeof UserPreferenceMetadata.Type;

export type UserPreference = typeof UserPreference.Type;
export type UserPreferenceUpdate = typeof UserPreferenceUpdate.Type;
export type UserPreferenceInsert = typeof UserPreferenceInsert.Type;
