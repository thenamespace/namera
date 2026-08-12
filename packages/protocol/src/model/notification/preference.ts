import { Schema, Struct } from "effect";

import { NotificationPreferenceId, OrganizationId, UserId } from "#/common/index";
import { TimestampFields } from "#/model/common";

import { NotificationCategory, NotificationChannel } from "./common.js";

export const NotificationPreference = Schema.Struct({
  id: NotificationPreferenceId,
  userId: UserId,
  organizationId: Schema.NullOr(OrganizationId),
  category: NotificationCategory,
  channel: NotificationChannel,
  enabled: Schema.Boolean,
}).mapFields(Struct.assign(TimestampFields));

export const NotificationPreferenceInsert = Schema.Struct({
  userId: UserId,
  organizationId: Schema.NullOr(OrganizationId),
  category: NotificationCategory,
  channel: NotificationChannel,
  enabled: Schema.Boolean,
});

export const NotificationPreferenceUpdate = Schema.Struct({
  enabled: Schema.Boolean,
});

export type NotificationPreference = typeof NotificationPreference.Type;
export type NotificationPreferenceInsert = typeof NotificationPreferenceInsert.Type;
export type NotificationPreferenceUpdate = typeof NotificationPreferenceUpdate.Type;
