import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { ExecutionError } from "@namera-ai/protocol";
import type { ExecuteRequest, GrantedActorData } from "@namera-ai/protocol/dto";
import type { EvmSessionKey, SessionKeyGrant } from "@namera-ai/protocol/model";

import { makeLoadEvmAccount } from "#/wallet/account";

export type GrantedEvmSessionKey = {
  readonly grant: SessionKeyGrant;
  readonly sessionKey: EvmSessionKey;
};

export const makePrepareExecution = Effect.gen(function* () {
  const evm = yield* Evm;
  const repository = yield* Repository;
  const loadEvmAccount = yield* makeLoadEvmAccount;

  return Effect.fn("application.execution.prepare")(function* (input: {
    readonly actor: GrantedActorData;
    readonly request: ExecuteRequest;
    readonly sponsorship: "none" | "sponsored";
  }) {
    const wallet = yield* repository.core.wallet.findById(
      input.request.walletId,
      input.actor.organizationId,
    );
    if (wallet === undefined || wallet.wallet.namespace !== input.request.namespace) {
      return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    }

    const account = yield* loadEvmAccount(wallet).pipe(
      Effect.mapError(() => new ExecutionError({ code: "EXECUTION_UNAVAILABLE" })),
    );
    const prepared = yield* evm.execution
      .prepare({
        chainId: input.request.chainId,
        account,
        calls: input.request.calls,
        sponsorship: input.sponsorship,
      })
      .pipe(Effect.mapError(() => new ExecutionError({ code: "EXECUTION_FAILED" })));
    const candidates = input.actor.grants.filter(
      (item): item is GrantedEvmSessionKey =>
        item.sessionKey.namespace === "eip155" &&
        item.sessionKey.walletId === input.request.walletId &&
        item.sessionKey.status === "active",
    );
    if (candidates.length === 0) {
      return yield* new ExecutionError({ code: "NO_AUTHORIZED_SESSION_KEY" });
    }

    return {
      namespace: "eip155" as const,
      wallet,
      account,
      prepared,
      candidates,
    };
  });
});
