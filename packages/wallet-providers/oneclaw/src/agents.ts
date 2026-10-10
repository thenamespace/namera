import { Effect, Schema } from "effect";

import {
  type OneClawCustomerAuthority,
  OneClawOwnerProvisioningRequest,
  type OneClawProvisionedOwnerAgent,
} from "@namera-ai/protocol/model";

import type { ClientContext } from "#/client";
import { oneClawError } from "#/errors";
import { AgentCreatedResponse, AgentResponse } from "#/responses";

export interface CustomerAgent {
  readonly authority: OneClawCustomerAuthority;
  readonly agentId: string;
}

export const makeAgents = ({ config, platform, request, customer }: ClientContext) => ({
  create: Effect.fn("wallet-providers.oneclaw.agents.create")(function* (input: {
    readonly request: OneClawOwnerProvisioningRequest;
    readonly authority: OneClawCustomerAuthority;
    readonly name: string;
  }) {
    const operation = "agents.create";
    const provisioning = input.request;
    yield* Schema.decodeUnknownEffect(Schema.toType(OneClawOwnerProvisioningRequest))(
      provisioning,
    ).pipe(Effect.mapError(() => oneClawError(operation, "INVALID_REQUEST")));
    yield* customer(operation, input.authority);
    if (
      provisioning.connection.id !== input.authority.connection.id ||
      provisioning.connection.organizationId !== input.authority.connection.organizationId ||
      provisioning.connection.externalConnectionId !==
        input.authority.payload.externalConnectionId ||
      provisioning.connection.customerCredentialId !== input.authority.payload.credentialId ||
      provisioning.connection.data.customerId !== input.authority.payload.customerId ||
      input.authority.connection.status !== "ready" ||
      provisioning.connection.providerAppId !== config.platformAppId
    ) {
      return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    }
    const response = yield* request(operation, AgentCreatedResponse, () =>
      platform.platform.withConnection(input.authority.payload.externalConnectionId).agents.create({
        name: input.name,
        intents_api_enabled: true,
      }),
    );
    // Return immediately: the workflow must encrypt/save this one-time key before
    // any follow-up network call can fail.
    return {
      request: provisioning,
      credential: {
        version: 1,
        credentialId: provisioning.agentCredentialId,
        organizationId: provisioning.connection.organizationId,
        agentId: response.agent.id,
        apiKey: response.api_key,
      },
    } satisfies OneClawProvisionedOwnerAgent;
  }),
  get: Effect.fn("wallet-providers.oneclaw.agents.get")(function* (input: CustomerAgent) {
    const operation = "agents.get";
    const authenticated = yield* customer(operation, input.authority);
    const agent = yield* request(operation, AgentResponse, () =>
      authenticated.agents.get(input.agentId),
    );
    if (agent.id !== input.agentId) return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    return agent;
  }),
  setRawSigningEnabled: Effect.fn("wallet-providers.oneclaw.agents.setRawSigningEnabled")(
    function* (
      input: CustomerAgent & {
        readonly enabled: boolean;
      },
    ) {
      const operation = "agents.setRawSigningEnabled";
      const authenticated = yield* customer(operation, input.authority);
      yield* request(operation, Schema.Unknown, () =>
        authenticated.agents.update(input.agentId, { raw_signing_enabled: input.enabled }),
      );
      const agent = yield* request(operation, AgentResponse, () =>
        authenticated.agents.get(input.agentId),
      );
      if (agent.id !== input.agentId) return yield* oneClawError(operation, "IDENTITY_MISMATCH");
      if (input.enabled && agent.raw_signing_policy === "approve")
        return yield* oneClawError(operation, "APPROVAL_REQUIRED");
      if (
        agent.raw_signing_enabled !== input.enabled ||
        (input.enabled &&
          (!agent.is_active || !agent.intents_api_enabled || agent.raw_signing_policy === "deny"))
      ) {
        return yield* oneClawError(operation, "SIGNING_DISABLED");
      }
      return agent;
    },
  ),
});
