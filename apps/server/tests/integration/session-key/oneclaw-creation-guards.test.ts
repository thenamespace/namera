import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Repository } from "@namera-ai/database";
import { makeTestEvmSessionService } from "@namera-ai/evm";
import { EvmExecutionError } from "@namera-ai/protocol";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";

for (const scenario of ["compile-failure", "connection-disabled", "expired"] as const) {
  const sessions = makeTestEvmSessionService();
  const Live = makeTestServerLayer(
    {
      sessions:
        scenario === "compile-failure"
          ? {
              ...sessions,
              compile: () =>
                Effect.fail(
                  new EvmExecutionError({
                    code: "NETWORK_PAUSED",
                    cause: new Error("Test paused network"),
                  }),
                ),
            }
          : sessions,
    },
    undefined,
    makeTestConfigLayer({
      ONECLAW_PLATFORM_APP_ID: "test-app",
      ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
    }),
    undefined,
    Layer.unwrap(
      Effect.gen(function* () {
        const repository = yield* Repository;
        return oneClawAccountTestLayer({
          agents: {
            setRawSigningEnabled: ({ authority, agentId, enabled }) =>
              Effect.gen(function* () {
                if (scenario === "connection-disabled") {
                  yield* repository.core.providerConnections
                    .disable({
                      id: authority.connection.id,
                      organizationId: authority.connection.organizationId,
                    })
                    .pipe(Effect.orDie);
                }
                if (scenario === "expired") yield* TestClock.adjust("2 hours");
                return {
                  id: agentId,
                  is_active: true,
                  intents_api_enabled: true,
                  raw_signing_enabled: enabled,
                  raw_signing_policy: "allow" as const,
                };
              }),
          },
        });
      }),
    ),
  );
  layer(Live)(`managed session guard: ${scenario}`, (it) => {
    it.effect("fails closed without persisting a session", () =>
      Effect.gen(function* () {
        yield* resetTestState();
        yield* TestClock.setTime(Date.now());
        const control = yield* OneClawTestControl;
        yield* Ref.set(control.calls, []);
        const client = yield* makeTestApiClient;
        const actor = yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
        const wallet = yield* createTestPasskeyWallet(client);
        const request = yield* localSessionRequest(wallet.id);
        expect(
          yield* client.sessionKey
            .create({
              payload: {
                ...request,
                signer: { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1" },
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({
          code:
            scenario === "compile-failure"
              ? "NETWORK_PAUSED"
              : scenario === "expired"
                ? "TIME_WINDOW_EXPIRED"
                : "PROVIDER_RECOVERY_REQUIRED",
        });
        const repository = yield* Repository;
        expect(
          yield* repository.core.sessionKey.findForOrganization(actor.actor.organization.id),
        ).toEqual([]);
        const calls = yield* Ref.get(control.calls);
        if (scenario === "compile-failure") expect(calls).toEqual([]);
        else {
          expect(calls.filter((op) => op === "agents.create")).toHaveLength(1);
          expect(
            (yield* repository.audit.organization.findForOrganization(
              actor.actor.organization.id,
            )).filter(
              (event) =>
                event.event === "provider_credential.saved" && event.data.type === "1claw-agent",
            ),
          ).toHaveLength(1);
        }
      }),
    );
  });
}
