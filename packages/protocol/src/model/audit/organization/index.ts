import { Schema, Struct } from "effect";

import { createInsertSchema } from "#/model/helpers";

import { ApiKeyCreatedEventData, ApiKeyRevokedEventData } from "./api-key.js";
import { OrganizationEventCommon } from "./base.js";
import {
  CliAuthorizationApprovedEventData,
  CliAuthorizationRevokedEventData,
} from "./cli-authorization.js";
import {
  ExecutionConfirmedEventData,
  ExecutionSigningEventData,
  ExecutionFailedEventData,
  ExecutionSubmittedEventData,
} from "./execution.js";
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
import {
  McpAuthorizationApprovedEventData,
  McpAuthorizationRevokedEventData,
} from "./oauth-authorization.js";
import {
  BillingPlanChangedEventData,
  OrganizationCreatedEventData,
  OrganizationUpdatedEventData,
} from "./organization.js";
import { ProviderConnectionEventData, ProviderCredentialEventData } from "./provider.js";
import {
  SessionKeyCreatedEventData,
  SessionKeyRevokedEventData,
  SessionKeyOperationEventData,
} from "./session-key.js";
import { SignatureCreatedEventData } from "./signature.js";
import {
  WalletCreatedEventData,
  SigningKeyCreatedEventData,
  WalletUpdatedEventData,
} from "./wallet.js";

const organizationEvent = <Fields extends Schema.Struct.Fields>(fields: Schema.Struct<Fields>) =>
  OrganizationEventCommon.mapFields(Struct.assign(fields.fields));

export const OrganizationCreatedEvent = organizationEvent(OrganizationCreatedEventData);
export const OrganizationUpdatedEvent = organizationEvent(OrganizationUpdatedEventData);
export const BillingPlanChangedEvent = organizationEvent(BillingPlanChangedEventData);
export const InvitationCreatedEvent = organizationEvent(InvitationCreatedEventData);
export const InvitationAcceptedEvent = organizationEvent(InvitationAcceptedEventData);
export const InvitationRejectedEvent = organizationEvent(InvitationRejectedEventData);
export const InvitationCanceledEvent = organizationEvent(InvitationCanceledEventData);
export const MemberCreatedEvent = organizationEvent(MemberCreatedEventData);
export const MemberRoleUpdatedEvent = organizationEvent(MemberRoleUpdatedEventData);
export const MemberRemovedEvent = organizationEvent(MemberRemovedEventData);
export const WalletCreatedEvent = organizationEvent(WalletCreatedEventData);
export const SigningKeyCreatedEvent = organizationEvent(SigningKeyCreatedEventData);
export const WalletUpdatedEvent = organizationEvent(WalletUpdatedEventData);
export const SessionKeyCreatedEvent = organizationEvent(SessionKeyCreatedEventData);
export const SessionKeyRevokedEvent = organizationEvent(SessionKeyRevokedEventData);
export const SessionKeyOperationEvent = organizationEvent(SessionKeyOperationEventData);
export const ApiKeyCreatedEvent = organizationEvent(ApiKeyCreatedEventData);
export const ApiKeyRevokedEvent = organizationEvent(ApiKeyRevokedEventData);
export const McpAuthorizationApprovedEvent = organizationEvent(McpAuthorizationApprovedEventData);
export const McpAuthorizationRevokedEvent = organizationEvent(McpAuthorizationRevokedEventData);
export const CliAuthorizationApprovedEvent = organizationEvent(CliAuthorizationApprovedEventData);
export const CliAuthorizationRevokedEvent = organizationEvent(CliAuthorizationRevokedEventData);
export const ExecutionSubmittedEvent = organizationEvent(ExecutionSubmittedEventData);
export const ExecutionSigningEvent = organizationEvent(ExecutionSigningEventData);
export const ExecutionConfirmedEvent = organizationEvent(ExecutionConfirmedEventData);
export const ExecutionFailedEvent = organizationEvent(ExecutionFailedEventData);
export const SignatureCreatedEvent = organizationEvent(SignatureCreatedEventData);
export const ProviderConnectionEvent = organizationEvent(ProviderConnectionEventData);
export const ProviderCredentialEvent = organizationEvent(ProviderCredentialEventData);

export const OrganizationEvent = Schema.Union([
  OrganizationCreatedEvent,
  OrganizationUpdatedEvent,
  BillingPlanChangedEvent,
  InvitationCreatedEvent,
  InvitationAcceptedEvent,
  InvitationRejectedEvent,
  InvitationCanceledEvent,
  MemberCreatedEvent,
  MemberRoleUpdatedEvent,
  MemberRemovedEvent,
  WalletCreatedEvent,
  SigningKeyCreatedEvent,
  WalletUpdatedEvent,
  SessionKeyCreatedEvent,
  SessionKeyRevokedEvent,
  SessionKeyOperationEvent,
  ApiKeyCreatedEvent,
  ApiKeyRevokedEvent,
  McpAuthorizationApprovedEvent,
  McpAuthorizationRevokedEvent,
  CliAuthorizationApprovedEvent,
  CliAuthorizationRevokedEvent,
  ExecutionSubmittedEvent,
  ExecutionSigningEvent,
  ExecutionConfirmedEvent,
  ExecutionFailedEvent,
  SignatureCreatedEvent,
  ProviderConnectionEvent,
  ProviderCredentialEvent,
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
export * from "./cli-authorization.js";
export * from "./execution.js";
export * from "./invitation.js";
export * from "./member.js";
export * from "./oauth-authorization.js";
export * from "./organization.js";
export * from "./session-key.js";
export * from "./signature.js";
export * from "./wallet.js";
