import { Schema } from "effect";

import { InvitationId, SessionId } from "#/common/index";

const NewSignInNotificationType = Schema.Literal("auth.new-sign-in");
const InvitationReceivedNotificationType = Schema.Literal("organization.invitation.received");

export const NotificationType = Schema.Union([
  NewSignInNotificationType,
  InvitationReceivedNotificationType,
]);

export const NewSignInNotificationPayload = Schema.Struct({
  type: NewSignInNotificationType,
  resourceType: Schema.Literal("session"),
  resourceId: SessionId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    ipAddress: Schema.NullOr(Schema.String),
    userAgent: Schema.NullOr(Schema.String),
  }),
});

export const InvitationReceivedNotificationPayload = Schema.Struct({
  type: InvitationReceivedNotificationType,
  resourceType: Schema.Literal("invitation"),
  resourceId: InvitationId,
  data: Schema.Struct({
    version: Schema.Literal(1),
  }),
});

export const NotificationPayload = Schema.Union([
  NewSignInNotificationPayload,
  InvitationReceivedNotificationPayload,
]);

export type NotificationPayload = typeof NotificationPayload.Type;
export type NotificationPayloadEncoded = typeof NotificationPayload.Encoded;
export type NotificationType = typeof NotificationType.Type;
