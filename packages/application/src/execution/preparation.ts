import { Effect } from "effect";

import { Evm } from "@namera-ai/evm";
import { ExecutionError } from "@namera-ai/protocol";
import type { PrepareExecutionRequest, GrantedActorData } from "@namera-ai/protocol/dto";

import { makeLoadExecutionAuthority } from "./authority.js";

/** Public-only account reconstruction shared by simulation and detached execution. */
export const makePrepareExecution = Effect.gen(function* () {
  const evm = yield* Evm;
  const loadAuthority = yield* makeLoadExecutionAuthority;
  return Effect.fn("application.execution.prepareUnsigned")(function* (input: {
    readonly actor: GrantedActorData;
    readonly request: PrepareExecutionRequest;
  }) {
    const authority = yield* loadAuthority({ ...input.request, actor: input.actor });
    const prepared = yield* evm.execution
      .prepare({
        account: authority.account,
        session: authority.installation.data,
        chainId: input.request.chainId,
        calls: input.request.calls,
        sponsorship: input.request.sponsor === false ? "none" : "alchemy-bso",
      })
      .pipe(
        Effect.mapError(
          (error) =>
            new ExecutionError({
              code:
                "code" in error && error.code === "NETWORK_PAUSED"
                  ? "NETWORK_PAUSED"
                  : "EXECUTION_FAILED",
            }),
        ),
      );
    return { authority, prepared };
  });
});
