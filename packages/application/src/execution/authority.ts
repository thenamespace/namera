import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  ExecutionError,
  type SessionKeyId,
  type SupportedEvmChainId,
  type WalletId,
} from "@namera-ai/protocol";
import type { GrantedActorData } from "@namera-ai/protocol/dto";

import { makeLoadSessionOperationOwner } from "#/session-key/operation-owner";

/** Resolve the exact installed authority. Locked calls run after the wallet lock. */
export const makeLoadExecutionAuthority = Effect.gen(function* () {
  const repository = yield* Repository;
  const loadOwner = yield* makeLoadSessionOperationOwner;
  return Effect.fn("application.execution.loadAuthority")(function* (input: {
    readonly actor: GrantedActorData;
    readonly walletId: WalletId;
    readonly sessionKeyId: SessionKeyId;
    readonly chainId: SupportedEvmChainId;
    readonly forUpdate?: boolean;
  }) {
    const selected = input.actor.grants.find(
      ({ sessionKey }) => sessionKey.id === input.sessionKeyId,
    );
    if (selected === undefined)
      return yield* new ExecutionError({ code: "NO_AUTHORIZED_SESSION_KEY" });
    const current = yield* repository.core.sessionKeyGrant.findByIdWithSessionKey(
      selected.grant.id,
      input.actor.organizationId,
      input.forUpdate,
    );
    if (
      current === undefined ||
      current.grant.actorId !== input.actor.actorId ||
      current.grant.revokedAt !== null ||
      current.sessionKey.status !== "active" ||
      current.sessionKey.walletId !== input.walletId ||
      current.sessionKey.id !== input.sessionKeyId
    )
      return yield* new ExecutionError({ code: "NO_AUTHORIZED_SESSION_KEY" });
    const installations = yield* repository.core.sessionKeyInstallation.findForSession(
      input.actor.organizationId,
      input.sessionKeyId,
    );
    const installation = installations.find(
      (value) => value.chainId === input.chainId && value.status === "installed",
    );
    if (installation === undefined)
      return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    const now = DateTime.toEpochSeconds(yield* DateTime.now);
    if (
      now < installation.data.authorization.validAfter ||
      now >= installation.data.authorization.validUntil
    )
      return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    const signer = yield* repository.core.signingKey.findById(
      current.sessionKey.signingKeyId,
      input.actor.organizationId,
    );
    if (
      signer === undefined ||
      signer.status !== "active" ||
      signer.custody !== "local" ||
      signer.algorithm !== "secp256k1" ||
      signer.purpose !== "session"
    )
      return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    const owner = yield* loadOwner({
      organizationId: input.actor.organizationId,
      installationId: installation.id,
    }).pipe(
      Effect.catchTag(
        "SessionKeyOperationError",
        () => new ExecutionError({ code: "EXECUTION_UNAVAILABLE" }),
      ),
    );
    return { ...current, installation, signer, account: owner.account, wallet: owner.wallet };
  });
});
