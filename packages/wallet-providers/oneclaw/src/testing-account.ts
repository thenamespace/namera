import { DateTime, Effect, Layer, Redacted } from "effect";

import { hexToBytes, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { OneClawOidcService } from "#/oidc";
import { oneClawTestLayer, type OneClawTestScenario } from "#/testing";

// Public deterministic test scalars only. This layer never contacts 1Claw.
const signer = (agentId: string) => privateKeyToAccount(keccak256(toHex(agentId)));
const key = (agentId: string) => ({
  id: `key-${agentId}`,
  agentId,
  chain: "ethereum" as const,
  curve: "secp256k1" as const,
  publicKey: signer(agentId).publicKey,
  address: signer(agentId).address,
  version: 1,
});
const claim = (connectionId: string) =>
  Effect.gen(function* () {
    return {
      connectionId,
      token: Redacted.make("test-claim"),
      expiresAt: DateTime.add(yield* DateTime.now, { minutes: 10 }),
    };
  });

export const oneClawAccountTestLayer = (overrides: OneClawTestScenario = {}) =>
  Layer.merge(
    Layer.succeed(OneClawOidcService, {
      publicJwks: Effect.succeed({ keys: [] }),
      issue: ({ organizationId }) => Effect.succeed(Redacted.make(`test-oidc-${organizationId}`)),
    }),
    oneClawTestLayer({
      connections: {
        upsert: ({ subjectToken }) =>
          Effect.succeed({ connectionId: Redacted.value(subjectToken) }),
        get: (connectionId) =>
          Effect.succeed({
            connectionId,
            customerId: `customer-${connectionId}`,
            status: "active",
          }),
        bootstrapEmpty: ({ connection }) =>
          connection.externalConnectionId === null
            ? Effect.die("Bootstrap requires a reconciled test connection")
            : claim(connection.externalConnectionId),
        reissueClaim: claim,
        ...overrides.connections,
      },
      customers: {
        redeemClaim: ({ claim: input, expectedCustomerId }) =>
          Effect.gen(function* () {
            return {
              connectionId: input.connectionId,
              customerId: expectedCustomerId,
              token: Redacted.make("test-customer-token"),
              expiresAt: DateTime.add(yield* DateTime.now, { hours: 24 }),
            };
          }),
        getIdentity: ({ payload }) => Effect.succeed({ customerId: payload.customerId }),
        enableDelegation: () => Effect.void,
        ...overrides.customers,
      },
      agents: {
        create: ({ request }) =>
          Effect.succeed({
            request,
            credential: {
              version: 1,
              credentialId: request.agentCredentialId,
              organizationId: request.connection.organizationId,
              agentId: `agent-${request.signingKeyId}`,
              apiKey: Redacted.make("test-agent-key"),
            },
          }),
        setRawSigningEnabled: ({ agentId, enabled }) =>
          Effect.succeed({
            id: agentId,
            is_active: true,
            intents_api_enabled: true,
            raw_signing_enabled: enabled,
            raw_signing_policy: "allow",
          }),
        ...overrides.agents,
      },
      signingKeys: {
        create: ({ agentId }) => Effect.succeed(key(agentId)),
        list: ({ agentId }) => Effect.succeed([key(agentId)]),
        ...overrides.signingKeys,
      },
      signing: {
        signDigest: ({ digest, key: signingKey }) =>
          Effect.promise(async () =>
            hexToBytes(await signer(signingKey.agentId).sign({ hash: toHex(digest) })),
          ),
        ...overrides.signing,
      },
    }),
  );
