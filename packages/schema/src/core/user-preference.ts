import { Schema } from "effect";

import { UserId, UserPreferenceId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const NotificationChannelPreferences = Schema.Struct({
  email: Schema.Boolean,
  inApp: Schema.Boolean,
  push: Schema.Boolean,
});

export const NotificationPreferences = Schema.Json;
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
