import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { EvmExecutionError } from "@namera-ai/protocol";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const provider = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture({
  prepare: (input) =>
    input.session === undefined
      ? provider.prepare(input)
      : Effect.fail(
          new EvmExecutionError({
            code: "SIMULATION_FAILED",
            cause: new Error("Simulation provider unavailable"),
          }),
        ),
});

layer(fixture.layer)("unavailable execution simulation", (it) => {
  it.effect("rejects preview and preparation without creating policy or billing holds", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("simulation-unavailable@namera.test"));
      const wallet = yield* createTestPasskeyWallet(client, "Simulation wallet");
      const session = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(wallet.id)),
          policies: [
            {
              type: "evm.native-spend-limit",
              version: 1,
              limits: [{ chainId: "eip155:1", period: "lifetime", maxAmount: 10n }],
            },
          ],
        },
      });
      yield* fixture.confirmOperation(client, session, "install");
      const before = yield* client.billing.get();
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Simulation agent" },
          durationDays: 7,
          sessionKeyIds: [session.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(apiKey.key);
      const payload = {
        namespace: "eip155" as const,
        walletId: wallet.id,
        sessionKeyId: session.id,
        chainId: "eip155:1" as const,
        calls: [{ to: wallet.address, value: 1n, data: "0x" as const }],
      };
      expect(yield* client.execution.simulate({ payload }).pipe(Effect.flip)).toMatchObject({
        code: "EXECUTION_FAILED",
      });
      expect(
        yield* client.execution
          .prepare({
            headers: { "idempotency-key": crypto.randomUUID() },
            payload,
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "EXECUTION_FAILED" });
      const repository = yield* Repository;
      for (const policy of session.policies) {
        expect(
          yield* repository.core.sessionKeyPolicyState.findForPolicy(
            owner.actor.organization.id,
            session.id,
            policy.id,
          ),
        ).toEqual([]);
      }
      expect(yield* (yield* Application).execution.reconcile()).toBe(0);
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect((yield* client.billing.get()).meters).toEqual(before.meters);
      expect(
        (yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        )).filter(({ event }) => event.startsWith("execution.")),
      ).toEqual([]);
    }),
  );
});
