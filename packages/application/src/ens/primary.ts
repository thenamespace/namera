import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { EthereumAddress, type EnsLabel } from "@namera-ai/protocol";

import type { WalletTransactionScope } from "../wallet/transactions/owner.js";
import type { makeIdentities } from "./identities.js";

type Scope = WalletTransactionScope & { readonly label: EnsLabel };
export const makeIdentityPrimary = (identities: Effect.Success<typeof makeIdentities>) =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const repository = yield* Repository;
    return {
      getPrimaryStatus: Effect.fn("application.ens.getPrimaryStatus")(
        function* (scope: Scope) {
          const identity = yield* identities.getIdentity(scope);
          const status = yield* evm.identity.status(
            identity.fullName,
            EthereumAddress.make(identity.owner),
          );
          const call = yield* evm.identity.call(identity.fullName);
          const operation = yield* repository.core.walletOperation.findLatestForCall({
            ...scope,
            chainId: "eip155:1",
            to: call.to,
            data: call.data,
          });
          return {
            ...status,
            operation: operation
              ? {
                  operationId: operation.id,
                  name: identity.fullName,
                  status: operation.status,
                  transactionHash: operation.transactionHash,
                  submissionBlocked:
                    (operation.status === "signed" || operation.status === "submitted") &&
                    (operation.data.submissionBlocked ?? false),
                  sponsor: operation.data.prepared.sponsorship === "alchemy-bso",
                  retryKey:
                    operation.kind === "transaction" &&
                    operation.status === "awaiting-signature" &&
                    operation.actorId === scope.actorId
                      ? operation.idempotencyKey
                      : null,
                }
              : null,
          };
        },
        Effect.catchTag("DatabaseError", Effect.die),
      ),
    };
  });
