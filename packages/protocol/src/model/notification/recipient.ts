import { Schema } from "effect";

import { EmailJobId, NotificationId, UserId } from "#/common/index";

export const NotificationRecipient = Schema.Struct({
  notificationId: NotificationId,
  userId: UserId,
  emailJobId: Schema.NullOr(EmailJobId),
  readAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  archivedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  receivedAt: Schema.DateTimeUtcFromDate,
});

export const NotificationRecipientInsert = Schema.Struct({
  notificationId: NotificationId,
  userId: UserId,
  emailJobId: Schema.optionalKey(EmailJobId),
});

export const NotificationRecipientUpdate = Schema.Struct({
  readAt: Schema.optionalKey(Schema.NullOr(Schema.DateTimeUtcFromDate)),
  archivedAt: Schema.optionalKey(Schema.NullOr(Schema.DateTimeUtcFromDate)),
});

export type NotificationRecipient = typeof NotificationRecipient.Type;
export type NotificationRecipientInsert = typeof NotificationRecipientInsert.Type;
export type NotificationRecipientUpdate = typeof NotificationRecipientUpdate.Type;
