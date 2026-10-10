import { Schema, Struct } from "effect";

import { CredentialId, Email, OrganizationId, ProviderConnectionId } from "#/common/index";
import { TimestampFields } from "#/model/common";

export const OneClawConnectionData = Schema.Struct({
  version: Schema.Literal(1),
  customerId: Schema.NullOr(Schema.NonEmptyString),
  oidcSubject: Schema.NonEmptyString,
  email: Email,
  bootstrapCompletedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  bootstrapAttemptedAt: Schema.optionalKey(Schema.DateTimeUtcFromString),
  delegationEnabledAt: Schema.NullOr(Schema.DateTimeUtcFromString),
});

const ProviderConnectionFields = {
  id: ProviderConnectionId,
  organizationId: OrganizationId,
  provider: Schema.Literal("1claw"),
  providerAppId: Schema.NonEmptyString,
  externalConnectionId: Schema.NullOr(Schema.NonEmptyString),
  customerCredentialId: Schema.NullOr(CredentialId),
  status: Schema.Literals(["pending", "ready", "disabled"]),
  data: OneClawConnectionData,
};

const setupComplete = Schema.makeFilter(
  (connection: {
    status: "pending" | "ready" | "disabled";
    customerCredentialId: unknown;
    externalConnectionId: unknown;
    data: { customerId: unknown; bootstrapCompletedAt: unknown; delegationEnabledAt: unknown };
  }) => {
    if ((connection.externalConnectionId === null) !== (connection.data.customerId === null)) {
      return "Remote connection and customer identity must be recorded together";
    }
    if (connection.data.bootstrapCompletedAt !== null && connection.externalConnectionId === null) {
      return "Bootstrap requires a remote connection";
    }
    if (
      connection.data.delegationEnabledAt !== null &&
      (connection.customerCredentialId === null || connection.data.bootstrapCompletedAt === null)
    ) {
      return "Delegation requires bootstrap and customer authority";
    }
    return connection.status !== "ready" ||
      (connection.externalConnectionId !== null &&
        connection.data.customerId !== null &&
        connection.customerCredentialId !== null &&
        connection.data.bootstrapCompletedAt !== null &&
        connection.data.delegationEnabledAt !== null)
      ? undefined
      : "Ready connections require verified setup and customer authority";
  },
);

export const ProviderConnectionInsert =
  Schema.Struct(ProviderConnectionFields).check(setupComplete);
export const ProviderConnection = Schema.Struct(ProviderConnectionFields)
  .mapFields(Struct.assign(TimestampFields))
  .check(setupComplete);

export type ProviderConnection = typeof ProviderConnection.Type;
export type ProviderConnectionInsert = typeof ProviderConnectionInsert.Type;
export type ProviderConnectionEncoded = typeof ProviderConnection.Encoded;
