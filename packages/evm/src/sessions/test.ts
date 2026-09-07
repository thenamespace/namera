import { Effect } from "effect";

import { EthereumAddress, Hex } from "@namera-ai/protocol";

import { makeTestEvmExecutionService } from "../execution/test.js";
import type { EvmSessionService } from "./types.js";

/** Persistence/HTTP substitute only; real calldata is covered in the Anvil lane. */
export const makeTestEvmSessionService = (): EvmSessionService => {
  const execution = makeTestEvmExecutionService();
  return {
    compile: Effect.fn("evm.sessions.test.compile")((input) =>
      Effect.succeed({
        version: 1,
        authorization: input.authorization,
        moduleAddress: EthereumAddress.make("0x0000000000000000000000000000000000000001"),
        isGlobal: input.authorization.permissions.some(({ type }) => type === "root"),
        installCallData: Hex.make("0x1234"),
        uninstallCallData: Hex.make("0xabcd"),
        hooks: [],
      }),
    ),
    prepareOperation: Effect.fn("evm.sessions.test.prepareOperation")((input) =>
      execution.prepare({
        account: input.account,
        chainId: input.chainId,
        sponsorship: input.sponsorship,
        calls: [
          {
            to: input.account.wallet.address,
            value: 0n,
            data:
              input.kind === "install"
                ? input.installation.installCallData
                : input.installation.uninstallCallData,
          },
        ],
      }),
    ),
  };
};
