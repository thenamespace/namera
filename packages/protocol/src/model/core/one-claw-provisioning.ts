import { DateTime, Schema } from "effect";

import { CredentialId, SigningKeyId } from "#/common/index";

import {
  OneClawAgentCredentialPayload,
  OneClawCustomerCredentialInsert,
  OneClawCustomerCredentialPayload,
} from "./credential.js";
import { ProviderConnection } from "./provider-connection.js";

// Internal decoded authority, not a vendor response or a public DTO. Expiry
// relative to the clock and revocation must still be checked by the workflow.
export const OneClawCustomerAuthority = Schema.Struct({
  connection: ProviderConnection,
  credential: OneClawCustomerCredentialInsert,
  payload: OneClawCustomerCredentialPayload,
}).check(
  Schema.makeFilter(({ connection, credential, payload }) => {
    const binding = credential.data;
    return connection.status !== "disabled" &&
      connection.customerCredentialId === credential.id &&
      credential.id === payload.credentialId &&
      connection.organizationId === credential.organizationId &&
      credential.organizationId === payload.organizationId &&
      connection.id === binding.providerConnectionId &&
      binding.providerConnectionId === payload.providerConnectionId &&
      connection.providerAppId === binding.providerAppId &&
      binding.providerAppId === payload.providerAppId &&
      connection.externalConnectionId === binding.externalConnectionId &&
      binding.externalConnectionId === payload.externalConnectionId &&
      connection.data.customerId === binding.customerId &&
      binding.customerId === payload.customerId &&
      DateTime.toEpochMillis(credential.expiresAt) === DateTime.toEpochMillis(payload.expiresAt)
      ? undefined
      : "Customer authority does not match the connection and credential";
  }),
);

const OwnerProvisioningFields = {
  signingKeyId: SigningKeyId,
  agentCredentialId: CredentialId,
  connection: ProviderConnection,
};

export const OneClawOrganizationSetupRequest = Schema.Struct({
  connection: ProviderConnection,
}).check(
  Schema.makeFilter(({ connection }) =>
    connection.status === "pending" &&
    connection.externalConnectionId !== null &&
    connection.data.customerId !== null &&
    connection.data.bootstrapCompletedAt === null
      ? undefined
      : "Bootstrap requires a reconciled, unbootstrapped pending connection",
  ),
);

// Organization bootstrap creates no signer. Every owner uses this same request.
export const OneClawOwnerProvisioningRequest = Schema.Struct({
  ...OwnerProvisioningFields,
  mode: Schema.optionalKey(Schema.Never),
  templateId: Schema.optionalKey(Schema.Never),
}).check(
  Schema.makeFilter(({ connection }) =>
    connection.status === "ready" ? undefined : "Agent provisioning requires a ready connection",
  ),
);

// Returned immediately after agent creation, before further key provisioning,
// so application can protect the one-time credential without waiting for a wallet.
export const OneClawProvisionedOwnerAgent = Schema.Struct({
  request: OneClawOwnerProvisioningRequest,
  credential: OneClawAgentCredentialPayload,
}).check(
  Schema.makeFilter(({ request, credential }) =>
    request.agentCredentialId === credential.credentialId &&
    request.connection.organizationId === credential.organizationId
      ? undefined
      : "Agent credential does not match the provisioning request",
  ),
);

export type OneClawCustomerAuthority = typeof OneClawCustomerAuthority.Type;
export type OneClawOrganizationSetupRequest = typeof OneClawOrganizationSetupRequest.Type;
export type OneClawOwnerProvisioningRequest = typeof OneClawOwnerProvisioningRequest.Type;
export type OneClawProvisionedOwnerAgent = typeof OneClawProvisionedOwnerAgent.Type;
