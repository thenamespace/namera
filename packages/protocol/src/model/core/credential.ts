import { Schema, Struct } from "effect";

import { CredentialId, OrganizationId } from "#/common/index";
import { TimestampFields } from "#/model/common";

export const CredentialType = Schema.Literal("1claw-agent");

export const OneClawAgentCredentialData = Schema.Struct({
  version: Schema.Literal(1),
  agentId: Schema.NonEmptyString,
});

export const CredentialInsert = Schema.Struct({
  id: CredentialId,
  organizationId: OrganizationId,
  type: CredentialType,
  data: OneClawAgentCredentialData,
  encryptedPayload: Schema.NonEmptyString,
});

export const Credential = CredentialInsert.mapFields(Struct.assign(TimestampFields));

// Decode only inside the encryption boundary; check all bindings against the
// credential row and signing key before using the API key.
export const OneClawAgentCredentialPayload = Schema.Struct({
  version: Schema.Literal(1),
  credentialId: CredentialId,
  organizationId: OrganizationId,
  agentId: Schema.NonEmptyString,
  apiKey: Schema.RedactedFromValue(Schema.NonEmptyString),
});

export type CredentialType = typeof CredentialType.Type;
export type OneClawAgentCredentialData = typeof OneClawAgentCredentialData.Type;
export type OneClawAgentCredentialPayload = typeof OneClawAgentCredentialPayload.Type;
export type CredentialInsert = typeof CredentialInsert.Type;
export type Credential = typeof Credential.Type;
