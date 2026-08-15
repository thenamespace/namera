import { Schema, Struct } from "effect";

import { ActorId, NotificationId, OrganizationId } from "#/common/index";
import { NonEmptyString } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

import {
  ApiKeyCreatedNotificationPayload,
  ExecutionConfirmedNotificationPayload,
  InvitationReceivedNotificationPayload,
  NewSignInNotificationPayload,
  SessionKeyCreatedNotificationPayload,
  WalletCreatedNotificationPayload,
} from "./payload.js";

const NotificationCommon = Schema.Struct({
  id: NotificationId,
  organizationId: Schema.NullOr(OrganizationId),
  actorId: Schema.NullOr(ActorId),
  idempotencyKey: NonEmptyString,
  correlationId: NonEmptyString,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
});

const notification = <Fields extends Schema.Struct.Fields>(fields: Schema.Struct<Fields>) =>
  NotificationCommon.mapFields(Struct.assign(fields.fields));

export const NewSignInNotification = notification(NewSignInNotificationPayload);
export const InvitationReceivedNotification = notification(InvitationReceivedNotificationPayload);
export const WalletCreatedNotification = notification(WalletCreatedNotificationPayload);
export const SessionKeyCreatedNotification = notification(SessionKeyCreatedNotificationPayload);
export const ApiKeyCreatedNotification = notification(ApiKeyCreatedNotificationPayload);
export const ExecutionConfirmedNotification = notification(ExecutionConfirmedNotificationPayload);

export const Notification = Schema.Union([
  NewSignInNotification,
  InvitationReceivedNotification,
  WalletCreatedNotification,
  SessionKeyCreatedNotification,
  ApiKeyCreatedNotification,
  ExecutionConfirmedNotification,
]);

export const NotificationInsert = createInsertSchema(
  Notification,
  "organizationId",
  "actorId",
  "type",
  "resourceType",
  "resourceId",
  "data",
  "idempotencyKey",
  "correlationId",
  "expiresAt",
);

export type Notification = typeof Notification.Type;
export type NotificationEncoded = typeof Notification.Encoded;
export type NotificationInsert = typeof NotificationInsert.Type;
