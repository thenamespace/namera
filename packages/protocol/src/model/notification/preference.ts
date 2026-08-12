import { Schema } from "effect";

import { NotificationPreferenceId, OrganizationId, UserId } from "#/common/index";
import { TimestampFields } from "#/model/common";

import { NotificationPreferenceChannel, withNotificationPreferenceTarget } from "./common.js";

const NotificationPreferenceScopeFields = {
  userId: UserId,
  organizationId: Schema.NullOr(OrganizationId),
  channel: NotificationPreferenceChannel,
};

export const NotificationPreferenceScope = withNotificationPreferenceTarget(
  NotificationPreferenceScopeFields,
);

export const NotificationPreference = withNotificationPreferenceTarget({
  id: NotificationPreferenceId,
  ...NotificationPreferenceScopeFields,
  enabled: Schema.Boolean,
  ...TimestampFields,
});

export const NotificationPreferenceInsert = withNotificationPreferenceTarget({
  ...NotificationPreferenceScopeFields,
  enabled: Schema.Boolean,
});

export const NotificationPreferenceUpdate = Schema.Struct({
  enabled: Schema.Boolean,
});

export type NotificationPreference = typeof NotificationPreference.Type;
export type NotificationPreferenceScope = typeof NotificationPreferenceScope.Type;
export type NotificationPreferenceInsert = typeof NotificationPreferenceInsert.Type;
export type NotificationPreferenceUpdate = typeof NotificationPreferenceUpdate.Type;
