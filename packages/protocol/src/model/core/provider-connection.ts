import { Schema, Struct } from "effect";

import { CredentialId, Email, OrganizationId, ProviderConnectionId } from "#/common/index";
import { TimestampFields } from "#/model/common";

export const OneClawConnectionData = Schema.Struct({
  version: Schema.Literal(1),
  customerId: Schema.NonEmptyString,
  oidcSubject: Schema.NonEmptyString,
  email: Email,
  bootstrapCompletedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  delegationEnabledAt: Schema.NullOr(Schema.DateTimeUtcFromString),
});

const ProviderConnectionFields = {
  id: ProviderConnectionId,
  organizationId: OrganizationId,
  provider: Schema.Literal("1claw"),
  providerAppId: Schema.NonEmptyString,
  externalConnectionId: Schema.NonEmptyString,
  customerCredentialId: Schema.NullOr(CredentialId),
  status: Schema.Literals(["pending", "ready", "disabled"]),
  data: OneClawConnectionData,
};

const setupComplete = Schema.makeFilter(
  (connection: {
    status: "pending" | "ready" | "disabled";
    customerCredentialId: unknown;
    data: { bootstrapCompletedAt: unknown; delegationEnabledAt: unknown };
  }) =>
    connection.status !== "ready" ||
    (connection.customerCredentialId !== null &&
      connection.data.bootstrapCompletedAt !== null &&
      connection.data.delegationEnabledAt !== null)
      ? undefined
      : "Ready connections require verified setup and customer authority",
);

export const ProviderConnectionInsert =
  Schema.Struct(ProviderConnectionFields).check(setupComplete);
export const ProviderConnection = Schema.Struct(ProviderConnectionFields)
  .mapFields(Struct.assign(TimestampFields))
  .check(setupComplete);

export type ProviderConnection = typeof ProviderConnection.Type;
export type ProviderConnectionInsert = typeof ProviderConnectionInsert.Type;
