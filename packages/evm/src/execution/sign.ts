import { Effect } from "effect";

import { EvmExecutionError } from "@namera-ai/protocol";

import type { ChainData } from "../chains/data.js";
import type { ExecutionClients } from "../clients/execution.js";
import { makeReconstructPreparedAccount } from "./prepared-account.js";
import { completeSignedEvmExecution } from "./signed-operation.js";
import type { SignEvmExecutionInput } from "./types.js";

export const makeSignEvmExecution = (getClients: (chain: ChainData) => ExecutionClients) => {
  const reconstruct = makeReconstructPreparedAccount(getClients);

  return Effect.fn("evm.execution.sign")(function* (input: SignEvmExecutionInput) {
    const { account, chain, userOperation } = yield* reconstruct(input);
    const signature = yield* Effect.tryPromise({
      try: () => account.signUserOperation({ ...userOperation, chainId: chain.chain.id }),
      catch: (cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause }),
    });
    return yield* completeSignedEvmExecution(input.prepared, chain, signature);
  });
};
