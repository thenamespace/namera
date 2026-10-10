import { Schema } from "effect";

import { CredentialId, ProviderConnectionId } from "#/common/index";

export const ProviderConnectionEventData = Schema.Struct({
  event: Schema.Literal("provider_connection.updated"),
  resourceType: Schema.Literal("provider-connection"),
  resourceId: ProviderConnectionId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    provider: Schema.Literal("1claw"),
    stage: Schema.Literals(["reserved", "identity", "bootstrap_started", "bootstrapped", "ready"]),
  }),
});

export const ProviderCredentialEventData = Schema.Struct({
  event: Schema.Literal("provider_credential.saved"),
  resourceType: Schema.Literal("credential"),
  resourceId: CredentialId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    type: Schema.Literals(["1claw-agent", "1claw-customer"]),
    renewed: Schema.Boolean,
  }),
});
