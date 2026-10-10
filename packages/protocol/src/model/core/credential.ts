import { Schema, Struct } from "effect";

import { CredentialId, OrganizationId, ProviderConnectionId } from "#/common/index";
import { TimestampFields } from "#/model/common";

export const CredentialType = Schema.Literals(["1claw-agent", "1claw-customer"]);

export const OneClawAgentCredentialData = Schema.Struct({
  version: Schema.Literal(1),
  agentId: Schema.NonEmptyString,
});

const CredentialFields = {
  id: CredentialId,
  organizationId: OrganizationId,
  encryptedPayload: Schema.NonEmptyString,
};

export const OneClawAgentCredentialInsert = Schema.Struct({
  ...CredentialFields,
  type: Schema.Literal("1claw-agent"),
  data: OneClawAgentCredentialData,
});

export const OneClawCustomerIdentityFields = {
  providerConnectionId: ProviderConnectionId,
  providerAppId: Schema.NonEmptyString,
  externalConnectionId: Schema.NonEmptyString,
  customerId: Schema.NonEmptyString,
};

export const OneClawCustomerCredentialData = Schema.Struct({
  version: Schema.Literal(1),
  ...OneClawCustomerIdentityFields,
});

export const OneClawCustomerCredentialInsert = Schema.Struct({
  ...CredentialFields,
  type: Schema.Literal("1claw-customer"),
  data: OneClawCustomerCredentialData,
  expiresAt: Schema.DateTimeUtcFromDate,
});

export const CredentialInsert = Schema.Union([
  OneClawAgentCredentialInsert,
  OneClawCustomerCredentialInsert,
]);

export const OneClawAgentCredential = OneClawAgentCredentialInsert.mapFields(
  Struct.assign(TimestampFields),
);

export const Credential = Schema.Union([
  OneClawAgentCredential,
  OneClawCustomerCredentialInsert.mapFields(Struct.assign(TimestampFields)),
]);

// Decode only inside the encryption boundary; check all bindings against the
// credential row and signing key before using the API key.
export const OneClawAgentCredentialPayload = Schema.Struct({
  version: Schema.Literal(1),
  credentialId: CredentialId,
  organizationId: OrganizationId,
  agentId: Schema.NonEmptyString,
  apiKey: Schema.RedactedFromValue(Schema.NonEmptyString),
});

export const OneClawCustomerCredentialPayload = Schema.Struct({
  version: Schema.Literal(1),
  credentialId: CredentialId,
  organizationId: OrganizationId,
  ...OneClawCustomerIdentityFields,
  expiresAt: Schema.DateTimeUtcFromString,
  token: Schema.RedactedFromValue(Schema.NonEmptyString),
});

export type CredentialType = typeof CredentialType.Type;
export type OneClawAgentCredentialData = typeof OneClawAgentCredentialData.Type;
export type OneClawAgentCredentialInsert = typeof OneClawAgentCredentialInsert.Type;
export type OneClawAgentCredential = typeof OneClawAgentCredential.Type;
export type OneClawAgentCredentialPayload = typeof OneClawAgentCredentialPayload.Type;
export type OneClawCustomerCredentialData = typeof OneClawCustomerCredentialData.Type;
export type OneClawCustomerCredentialPayload = typeof OneClawCustomerCredentialPayload.Type;
export type CredentialInsert = typeof CredentialInsert.Type;
export type Credential = typeof Credential.Type;
