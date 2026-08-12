import { Schema, Struct } from "effect";

import { createInsertSchema } from "#/model/helpers";

import { UserCreatedEventData, UserSignedInEventData, UserUpdatedEventData } from "./account.js";
import { UserEventCommon } from "./base.js";
import { NotificationPreferenceUpdatedEventData } from "./notification.js";
import {
  OtherSessionsRevokedEventData,
  SessionActiveOrganizationChangedEventData,
  SessionRevokedEventData,
} from "./session.js";

export const UserCreatedEvent = UserEventCommon.mapFields(
  Struct.assign(UserCreatedEventData.fields),
);
export const UserSignedInEvent = UserEventCommon.mapFields(
  Struct.assign(UserSignedInEventData.fields),
);
export const UserUpdatedEvent = UserEventCommon.mapFields(
  Struct.assign(UserUpdatedEventData.fields),
);
export const SessionRevokedEvent = UserEventCommon.mapFields(
  Struct.assign(SessionRevokedEventData.fields),
);
export const OtherSessionsRevokedEvent = UserEventCommon.mapFields(
  Struct.assign(OtherSessionsRevokedEventData.fields),
);
export const SessionActiveOrganizationChangedEvent = UserEventCommon.mapFields(
  Struct.assign(SessionActiveOrganizationChangedEventData.fields),
);
export const NotificationPreferenceUpdatedEvent = UserEventCommon.mapFields(
  Struct.assign(NotificationPreferenceUpdatedEventData.fields),
);

export const UserEvent = Schema.Union([
  UserCreatedEvent,
  UserSignedInEvent,
  UserUpdatedEvent,
  SessionRevokedEvent,
  OtherSessionsRevokedEvent,
  SessionActiveOrganizationChangedEvent,
  NotificationPreferenceUpdatedEvent,
]);

export const UserEventInsert = createInsertSchema(
  UserEvent,
  "userId",
  "sessionId",
  "event",
  "source",
  "data",
  "correlationId",
  "requestId",
  "traceId",
);

export type UserEvent = typeof UserEvent.Type;
export type UserEventEncoded = typeof UserEvent.Encoded;
export type UserEventInsert = typeof UserEventInsert.Type;

export * from "./account.js";
export * from "./base.js";
export * from "./notification.js";
export * from "./session.js";
