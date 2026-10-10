import { Effect, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Repository } from "@namera-ai/database";
import {
  makeTestEvmExecutionService,
  makeTestEvmSessionService,
  type EvmExecutionService,
} from "@namera-ai/evm";
import { EthereumAddress, Hex } from "@namera-ai/protocol";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "./index.js";
import { makeTestConfigLayer } from "./layers/config.js";
import { makeTestServerLayer } from "./layers/index.js";
import { localSessionRequest } from "./local-session.js";

const execution = makeTestEvmExecutionService({}, { signWithOwner: true });
export const managedSessionLayer = (overrides: Partial<EvmExecutionService> = {}) =>
  makeTestServerLayer(
    {
      sessions: makeTestEvmSessionService(),
      execution: {
        sign: execution.sign,
        sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
        getReceipt: (input) =>
          Effect.gen(function* () {
            const receipt = yield* execution.getReceipt(input);
            if (Option.isNone(receipt)) return receipt;
            return Option.some({
              ...receipt.value,
              sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
            });
          }),
        ...overrides,
      },
    },
    undefined,
    makeTestConfigLayer({
      ONECLAW_PLATFORM_APP_ID: "test-app",
      ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
    }),
    undefined,
    oneClawAccountTestLayer(),
  );

export const setupManagedSession = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
  const control = yield* OneClawTestControl;
  yield* Ref.set(control.calls, []);
  yield* Ref.set(control.failNext, undefined);
  const client = yield* makeTestApiClient;
  const actor = yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
  const wallet = yield* client.wallet.create({
    payload: {
      namespace: "eip155",
      owner: { type: "namera-managed", provider: "1claw" },
      metadata: { version: 1, name: "Managed owner" },
    },
  });
  yield* Ref.set(control.calls, []);
  const session = yield* client.sessionKey.create({
    payload: yield* localSessionRequest(wallet.id, ["eip155:11155111"]),
  });
  const installation = session.installations[0];
  if (!installation) return yield* Effect.die("Missing session installation");
  const request = {
    payload: {
      installationId: installation.id,
      kind: "install" as const,
      sponsor: false,
      idempotencyKey: crypto.randomUUID(),
    },
  };
  const prepared = yield* client.sessionKey.prepareManagedOperation(request);
  return {
    client,
    actor,
    organizationId: actor.actor.organization.id,
    wallet,
    session,
    installation,
    request,
    prepared,
    control,
    repository: yield* Repository,
  };
});
