import { Duration, Effect, Option } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import {
  makeTestEvmExecutionService,
  makeTestEvmSessionService,
  TestEvmExecution,
  type EvmExecutionService,
} from "@namera-ai/evm";
import { createTestAuthenticator } from "@namera-ai/passkeys/testing";
import { EthereumAddress, Hex } from "@namera-ai/protocol";
import type { SessionKeyResponse } from "@namera-ai/protocol/dto";

import type { TestApiClient } from "./api.js";
import { makeTestServerLayer } from "./layers/index.js";

/** Real passkey verification; chain encoding and enforcement run in the Anvil suite. */
export const makeOwnerSessionTestFixture = (
  executionOverrides: Partial<EvmExecutionService> = {},
) => {
  const authenticator = createTestAuthenticator();
  const execution = makeTestEvmExecutionService();
  return {
    authenticator,
    confirmOperation: Effect.fn("test.confirmSessionOperation")(function* (
      client: TestApiClient,
      session: SessionKeyResponse,
      kind: "install" | "uninstall",
    ) {
      for (const installation of session.installations) {
        const prepared = yield* client.sessionKey.prepareOperation({
          payload: {
            installationId: installation.id,
            kind,
            sponsor: false,
            idempotencyKey: crypto.randomUUID(),
          },
        });
        yield* client.sessionKey.completeOperation({
          payload: {
            operationId: prepared.operationId,
            response: authenticator.authenticate({
              challenge: prepared.options.challenge,
              origin: "http://dashboard.test",
              rpId: "dashboard.test",
              // Counterless authenticators are valid WebAuthn devices. Dedicated
              // approval tests exercise monotonic counters and replay rejection.
              counter: 0,
            }),
          },
        });
        yield* (yield* TestEvmExecution).setReceiptMode("immediate");
        yield* TestClock.adjust(Duration.seconds(2));
        yield* (yield* Application).sessionKey.reconcileOperations();
      }
      return yield* client.sessionKey.get({ params: { sessionKeyId: session.id } });
    }),
    layer: makeTestServerLayer(
      {
        sessions: makeTestEvmSessionService(),
        execution: {
          ownerApprovalChallenge: () => Effect.succeed(Hex.make(`0x${"11".repeat(32)}`)),
          completeOwnerApproval: execution.sign,
          getReceipt: Effect.fn("test.ownerOperation.receipt")(function* (input) {
            const receipt = yield* execution.getReceipt(input);
            if (Option.isNone(receipt)) return receipt;
            return Option.some({
              ...receipt.value,
              sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
            });
          }),
          ...executionOverrides,
        },
      },
      authenticator.layer,
    ),
  };
};
