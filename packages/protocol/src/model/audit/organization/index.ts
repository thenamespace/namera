import { Schema, Struct } from "effect";

import { createInsertSchema } from "#/model/helpers";

import { ApiKeyCreatedEventData } from "./api-key.js";
import { OrganizationEventCommon } from "./base.js";
import {
  InvitationAcceptedEventData,
  InvitationCanceledEventData,
  InvitationCreatedEventData,
  InvitationRejectedEventData,
} from "./invitation.js";
import {
  MemberCreatedEventData,
  MemberRemovedEventData,
  MemberRoleUpdatedEventData,
} from "./member.js";
import { OrganizationCreatedEventData, OrganizationUpdatedEventData } from "./organization.js";
import { SessionKeyCreatedEventData } from "./session-key.js";
import { WalletCreatedEventData, WalletKeyCreatedEventData } from "./wallet.js";

const organizationEvent = <Fields extends Schema.Struct.Fields>(fields: Schema.Struct<Fields>) =>
  OrganizationEventCommon.mapFields(Struct.assign(fields.fields));

export const OrganizationCreatedEvent = organizationEvent(OrganizationCreatedEventData);
export const OrganizationUpdatedEvent = organizationEvent(OrganizationUpdatedEventData);
export const InvitationCreatedEvent = organizationEvent(InvitationCreatedEventData);
export const InvitationAcceptedEvent = organizationEvent(InvitationAcceptedEventData);
export const InvitationRejectedEvent = organizationEvent(InvitationRejectedEventData);
export const InvitationCanceledEvent = organizationEvent(InvitationCanceledEventData);
export const MemberCreatedEvent = organizationEvent(MemberCreatedEventData);
export const MemberRoleUpdatedEvent = organizationEvent(MemberRoleUpdatedEventData);
export const MemberRemovedEvent = organizationEvent(MemberRemovedEventData);
export const WalletCreatedEvent = organizationEvent(WalletCreatedEventData);
export const WalletKeyCreatedEvent = organizationEvent(WalletKeyCreatedEventData);
export const SessionKeyCreatedEvent = organizationEvent(SessionKeyCreatedEventData);
export const ApiKeyCreatedEvent = organizationEvent(ApiKeyCreatedEventData);

export const OrganizationEvent = Schema.Union([
  OrganizationCreatedEvent,
  OrganizationUpdatedEvent,
  InvitationCreatedEvent,
  InvitationAcceptedEvent,
  InvitationRejectedEvent,
  InvitationCanceledEvent,
  MemberCreatedEvent,
  MemberRoleUpdatedEvent,
  MemberRemovedEvent,
  WalletCreatedEvent,
  WalletKeyCreatedEvent,
  SessionKeyCreatedEvent,
  ApiKeyCreatedEvent,
]);

export const OrganizationEventInsert = createInsertSchema(
  OrganizationEvent,
  "organizationId",
  "actorId",
  "event",
  "source",
  "resourceType",
  "resourceId",
  "data",
  "correlationId",
  "requestId",
  "traceId",
);

export type OrganizationEvent = typeof OrganizationEvent.Type;
export type OrganizationEventEncoded = typeof OrganizationEvent.Encoded;
export type OrganizationEventInsert = typeof OrganizationEventInsert.Type;

export * from "./base.js";
export * from "./api-key.js";
export * from "./invitation.js";
export * from "./member.js";
export * from "./organization.js";
export * from "./session-key.js";
export * from "./wallet.js";
