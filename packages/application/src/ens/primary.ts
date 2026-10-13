import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { EthereumAddress, type EnsLabel } from "@namera-ai/protocol";
import type {
  ApproveIdentityPrimaryRequest,
  PrepareIdentityPrimaryRequest,
} from "@namera-ai/protocol/dto";

import type { makeIdentities } from "./identities.js";
import { makeApproveIdentityPrimary, primaryOperationView } from "./primary-approve.js";
import type { PrimaryScope } from "./primary-owner.js";
import { makePrepareIdentityPrimary } from "./primary-prepare.js";
import { makeReconcileIdentityPrimary } from "./primary-reconcile.js";

type Scope = PrimaryScope & { readonly label: EnsLabel };
export const makeIdentityPrimary = (identities: Effect.Success<typeof makeIdentities>) =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const repository = yield* Repository;
    const prepare = yield* makePrepareIdentityPrimary;
    const approve = yield* makeApproveIdentityPrimary;
    const reconcilePrimary = yield* makeReconcileIdentityPrimary;
    return {
      reconcilePrimary,
      getPrimaryStatus: Effect.fn("application.ens.getPrimaryStatus")(
        function* (scope: Scope) {
          const identity = yield* identities.getIdentity(scope);
          const status = yield* evm.identity.status(
            identity.fullName,
            EthereumAddress.make(identity.owner),
          );
          const operation =
            (yield* repository.core.walletOperation.findActiveForWalletChain({
              ...scope,
              chainId: "eip155:1",
            })) ??
            (yield* repository.core.walletOperation.findLatestForName({
              ...scope,
              name: identity.fullName,
            }));
          return {
            ...status,
            operation: operation ? primaryOperationView(operation, scope.actorId) : null,
          };
        },
        Effect.catchTag("DatabaseError", Effect.die),
      ),
      preparePrimary: Effect.fn("application.ens.prepareIdentityPrimary")(function* (
        scope: Scope & { readonly request: PrepareIdentityPrimaryRequest },
      ) {
        yield* identities.getIdentity(scope);
        return yield* prepare(scope);
      }),
      approvePrimary: Effect.fn("application.ens.approveIdentityPrimary")(function* (
        scope: Scope & { readonly request: ApproveIdentityPrimaryRequest },
      ) {
        yield* identities.getIdentity(scope);
        return yield* approve(scope);
      }),
    };
  });
