import { Schema } from "effect";

import { NotificationId, OrganizationId } from "#/common/index";
import {
  ApiKeyCreatedNotification,
  InvitationReceivedNotification,
  NewSignInNotification,
  NotificationPreference,
  NotificationPreferenceChannel,
  SessionKeyCreatedNotification,
  WalletCreatedNotification,
  withNotificationPreferenceTarget,
} from "#/model/notification/index";

const NotificationRecipientState = {
  readAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  receivedAt: Schema.DateTimeUtcFromDate,
};

export const NotificationResponse = Schema.Union([
  Schema.Struct({
    notification: NewSignInNotification,
    ...NotificationRecipientState,
  }),
  Schema.Struct({
    notification: InvitationReceivedNotification,
    ...NotificationRecipientState,
  }),
  Schema.Struct({
    notification: WalletCreatedNotification,
    ...NotificationRecipientState,
  }),
  Schema.Struct({
    notification: SessionKeyCreatedNotification,
    ...NotificationRecipientState,
  }),
  Schema.Struct({
    notification: ApiKeyCreatedNotification,
    ...NotificationRecipientState,
  }),
]).annotate({ identifier: "NotificationResponse" });

export const ListNotificationsRequest = Schema.Struct({
  cursor: Schema.optionalKey(NotificationId),
}).annotate({ identifier: "ListNotificationsRequest" });

export const ListNotificationsResponse = Schema.Struct({
  items: Schema.Array(NotificationResponse),
  nextCursor: Schema.NullOr(NotificationId),
}).annotate({ identifier: "ListNotificationsResponse" });

export const UnreadNotificationCountResponse = Schema.Struct({
  count: Schema.Int,
}).annotate({ identifier: "UnreadNotificationCountResponse" });

export const NotificationMutationRequest = Schema.Struct({
  notificationId: NotificationId,
}).annotate({ identifier: "NotificationMutationRequest" });

export const NotificationMutationResponse = Schema.Void;

export const MarkAllNotificationsReadResponse = Schema.Struct({
  count: Schema.Int,
}).annotate({ identifier: "MarkAllNotificationsReadResponse" });

export const NotificationPreferenceResponse = NotificationPreference.annotate({
  identifier: "NotificationPreferenceResponse",
});

export const ListNotificationPreferencesResponse = Schema.Array(
  NotificationPreferenceResponse,
).annotate({ identifier: "ListNotificationPreferencesResponse" });

const NotificationPreferenceRequestFields = {
  organizationId: Schema.NullOr(OrganizationId),
  channel: NotificationPreferenceChannel,
};

export const UpdateNotificationPreferenceRequest = withNotificationPreferenceTarget({
  ...NotificationPreferenceRequestFields,
  enabled: Schema.Boolean,
}).annotate({ identifier: "UpdateNotificationPreferenceRequest" });

export const UpdateNotificationPreferenceResponse = NotificationPreferenceResponse;

export const ResetNotificationPreferenceRequest = withNotificationPreferenceTarget(
  NotificationPreferenceRequestFields,
).annotate({ identifier: "ResetNotificationPreferenceRequest" });

export const ResetNotificationPreferenceResponse = Schema.Void;

export type NotificationResponse = typeof NotificationResponse.Type;
export type ListNotificationsRequest = typeof ListNotificationsRequest.Type;
export type ListNotificationsResponse = typeof ListNotificationsResponse.Type;
export type UnreadNotificationCountResponse = typeof UnreadNotificationCountResponse.Type;
export type NotificationMutationRequest = typeof NotificationMutationRequest.Type;
export type MarkAllNotificationsReadResponse = typeof MarkAllNotificationsReadResponse.Type;
export type NotificationPreferenceResponse = typeof NotificationPreferenceResponse.Type;
export type ListNotificationPreferencesResponse = typeof ListNotificationPreferencesResponse.Type;
export type UpdateNotificationPreferenceRequest = typeof UpdateNotificationPreferenceRequest.Type;
export type ResetNotificationPreferenceRequest = typeof ResetNotificationPreferenceRequest.Type;
