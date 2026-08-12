import { Schema } from "effect";

import { InvitationId, SessionId } from "#/common/index";

export const NewSignInNotificationPayload = Schema.Struct({
  type: Schema.Literal("auth.new-sign-in"),
  resourceType: Schema.Literal("session"),
  resourceId: SessionId,
  data: Schema.Struct({
    version: Schema.Literal(1),
  }),
});

export const InvitationReceivedNotificationPayload = Schema.Struct({
  type: Schema.Literal("organization.invitation.received"),
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
