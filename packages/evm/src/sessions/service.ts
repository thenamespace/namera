import { Effect } from "effect";

import {
  EthereumAddress,
  EvmExecutionError,
  Hex,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import type { EvmSessionInstallationData } from "@namera-ai/protocol/model";
import { createClient, custom } from "viem";

import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import type { EvmExecutionService } from "../execution/types.js";
import { compileEvmSession } from "./compile.js";
import type { EvmSessionService } from "./types.js";

export const makeEvmSessionService = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
  execution: Pick<EvmExecutionService, "prepare">,
): EvmSessionService => ({
  compile: Effect.fn("evm.sessions.compile")(function* (input) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined || !chain.operationsEnabled) {
      return yield* new UnsupportedChainError({ namespace: "eip155", chainId: input.chainId });
    }

    const { publicClient } = getClients(chain);
    const account = yield* reconstructEvmAccount(input.account, publicClient);
    const compiled = yield* Effect.tryPromise({
      try: () =>
        compileEvmSession(
          createClient({
            account,
            chain: chain.chain,
            transport: custom(publicClient, { retryCount: 0 }),
          }),
          input.authorization,
        ),
      catch: (cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause }),
    });

    return {
      version: 1,
      authorization: input.authorization,
      moduleAddress: EthereumAddress.make(compiled.moduleAddress),
      isGlobal: compiled.isGlobal,
      installCallData: Hex.make(compiled.installCallData),
      uninstallCallData: Hex.make(compiled.uninstallCallData),
      hooks: compiled.hooks.map((hook) => ({
        moduleAddress: EthereumAddress.make(hook.address),
        entityId: hook.entityId,
      })),
    } satisfies EvmSessionInstallationData;
  }),
  prepareOperation: Effect.fn("evm.sessions.prepareOperation")((input) =>
    execution.prepare({
      account: input.account,
      chainId: input.chainId,
      sponsorship: input.sponsorship,
      // Root approval is limited to the immutable compiler output persisted by
      // session creation. The transport never supplies arbitrary owner calls.
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
});
