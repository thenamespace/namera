import { Effect } from "effect";

import { packUOSignature } from "@alchemy/smart-accounts";
import { EvmExecutionError } from "@namera-ai/protocol";
import { verifyMessage } from "viem";

import type { ChainData } from "../chains/data.js";
import type { ExecutionClients } from "../clients/execution.js";
import { makeReconstructPreparedAccount } from "./prepared-account.js";
import { completeSignedEvmExecution, preparedUserOperationHash } from "./signed-operation.js";
import type { CompleteEvmSessionExecutionInput, SignEvmSessionExecutionInput } from "./types.js";

export const makeEvmSessionSignature = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
) => {
  const reconstruct = makeReconstructPreparedAccount(getClients);
  const resolve = Effect.fn("evm.execution.resolveSessionSignature")(function* (
    input: SignEvmSessionExecutionInput,
  ) {
    const { chain } = yield* reconstruct(input);
    return { chain, message: preparedUserOperationHash(input.prepared, chain) };
  });

  return {
    message: Effect.fn("evm.execution.sessionSigningMessage")(function* (
      input: SignEvmSessionExecutionInput,
    ) {
      return (yield* resolve(input)).message;
    }),
    complete: Effect.fn("evm.execution.completeSessionExecution")(function* (
      input: CompleteEvmSessionExecutionInput,
    ) {
      const { chain, message } = yield* resolve(input);
      const valid = yield* Effect.tryPromise({
        try: () =>
          verifyMessage({
            address: input.session.authorization.signerAddress,
            message: { raw: message },
            signature: input.signature,
          }),
        catch: (cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause }),
      });
      if (!valid)
        return yield* new EvmExecutionError({
          code: "SIGNING_FAILED",
          cause: new Error("Signature does not match the session signer and prepared operation"),
        });
      return yield* completeSignedEvmExecution(
        input.prepared,
        chain,
        packUOSignature({ validationSignature: input.signature }),
      );
    }),
  };
};
