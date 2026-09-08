import { Effect, Option } from "effect";

import {
  makeTestEvmExecutionService,
  makeTestEvmSessionService,
  type EvmExecutionService,
} from "@namera-ai/evm";
import { createTestAuthenticator } from "@namera-ai/passkeys/testing";
import { EthereumAddress, Hex } from "@namera-ai/protocol";

import { makeTestServerLayer } from "./layers/index.js";

/** Real passkey verification; chain encoding and enforcement run in the Anvil suite. */
export const makeOwnerSessionTestFixture = (
  executionOverrides: Partial<EvmExecutionService> = {},
) => {
  const authenticator = createTestAuthenticator();
  const execution = makeTestEvmExecutionService();
  return {
    authenticator,
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
