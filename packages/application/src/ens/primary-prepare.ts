import { DateTime, Duration, Effect, Result, Schema } from "effect";
import * as HexEncoding from "effect/encoding/Hex";

import { CryptoService } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { IdentityPrimaryError, type EnsLabel } from "@namera-ai/protocol";
import {
  PasskeyAuthenticationOptions,
  type PrepareIdentityPrimaryRequest,
  type PrepareIdentityPrimaryResponse,
} from "@namera-ai/protocol/dto";
import type { WalletOperation } from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";

import { toEnsName } from "./data.js";
import { makePrimaryOwner, primaryFailure, type PrimaryScope } from "./primary-owner.js";

export const makePrepareIdentityPrimary = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const passkeys = yield* Passkeys;
  const config = yield* AuthConfig;
  const audit = yield* Audit;
  const owners = yield* makePrimaryOwner;
  return Effect.fn("application.ens.preparePrimary")(
    function* (
      scope: PrimaryScope & {
        readonly label: EnsLabel;
        readonly request: PrepareIdentityPrimaryRequest;
      },
    ) {
      const owner = yield* owners.load(scope);
      const name = toEnsName(scope.label);
      const status = yield* evm.identity.status(name, owner.wallet.wallet.data.address);
      if (status.forwardAddress?.toLowerCase() !== owner.wallet.wallet.data.address.toLowerCase())
        return yield* new IdentityPrimaryError({ code: "FORWARD_MISMATCH" });
      const requestHash = yield* crypto.hash({
        purpose: "identity.primary-operation",
        value: JSON.stringify({ walletId: scope.walletId, name }),
      });
      const idempotency = {
        organizationId: scope.organizationId,
        actorId: scope.actorId,
        idempotencyKey: scope.request.idempotencyKey,
      };
      const responseFor = Effect.fnUntraced(function* (
        operation: WalletOperation,
      ): Effect.fn.Return<PrepareIdentityPrimaryResponse, IdentityPrimaryError> {
        if (operation.requestHash !== requestHash)
          return yield* new IdentityPrimaryError({ code: "IDEMPOTENCY_CONFLICT" });
        if (operation.status !== "awaiting-signature")
          return yield* new IdentityPrimaryError({ code: "OPERATION_UNAVAILABLE" });
        if (
          DateTime.toEpochMillis(operation.expiresAt) <= DateTime.toEpochMillis(yield* DateTime.now)
        )
          return yield* new IdentityPrimaryError({ code: "APPROVAL_EXPIRED" });
        if (owner.type === "1claw")
          return {
            operationId: operation.id,
            approval: "1claw",
            options: null,
            prepared: operation.data.prepared,
            expiresAt: operation.expiresAt,
          };
        const challenge = yield* evm.execution
          .ownerApprovalChallenge({ account: owner.account, prepared: operation.data.prepared })
          .pipe(Effect.mapError(primaryFailure));
        const options = yield* passkeys
          .generateAuthenticationOptions({
            rpId: owner.credential.rpId,
            credentialId: owner.credential.credentialId,
            challenge: new Uint8Array(Result.getOrThrow(HexEncoding.decode(challenge.slice(2)))),
            timeoutMs: Math.min(
              Duration.toMillis(config.passkey.timeToLive),
              DateTime.toEpochMillis(operation.expiresAt) -
                DateTime.toEpochMillis(yield* DateTime.now),
            ),
          })
          .pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(PasskeyAuthenticationOptions)),
            Effect.mapError(primaryFailure),
          );
        return {
          operationId: operation.id,
          approval: "passkey",
          options,
          prepared: operation.data.prepared,
          expiresAt: operation.expiresAt,
        };
      });
      const previous =
        yield* repository.core.walletOperation.findByActorAndIdempotencyKey(idempotency);
      if (previous) return yield* responseFor(previous);
      const call = yield* evm.identity.call(name);
      const prepared = yield* evm.execution
        .prepare({
          account: owner.account,
          chainId: "eip155:1",
          calls: [call],
          sponsorship: "none",
        })
        .pipe(Effect.mapError(primaryFailure));
      const preparedOperation = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.core.wallet.findByIdForUpdate(scope.walletId, scope.organizationId);
          const current = yield* owners.load(scope);
          if (
            current.wallet.signingKey.id !== owner.wallet.signingKey.id ||
            current.wallet.signingKey.publicKeyHex !== owner.wallet.signingKey.publicKeyHex
          )
            return yield* new IdentityPrimaryError({ code: "OWNER_UNAVAILABLE" });
          const existing =
            yield* repository.core.walletOperation.findByActorAndIdempotencyKey(idempotency);
          if (existing) return existing;
          const chainScope = {
            organizationId: scope.organizationId,
            walletId: scope.walletId,
            chainId: "eip155:1" as const,
          };
          if (
            (yield* repository.core.walletOperation.findActiveForWalletChain(chainScope)) ||
            (yield* repository.core.sessionKeyOperation.findActiveForWalletChain(chainScope))
          )
            return yield* new IdentityPrimaryError({ code: "OPERATION_BUSY" });
          const { operation } = yield* repository.core.walletOperation.insert({
            ...idempotency,
            walletId: scope.walletId,
            chainId: "eip155:1",
            kind: "set-primary-name",
            requestHash,
            expiresAt: DateTime.addDuration(yield* DateTime.now, config.passkey.timeToLive),
            data: {
              version: 1,
              name,
              prepared,
              signed: null,
              owner: {
                signingKeyId: owner.wallet.signingKey.id,
                publicKey: owner.wallet.signingKey.publicKeyHex,
              },
            },
          });
          yield* audit.organization({
            organizationId: scope.organizationId,
            actorId: scope.actorId,
            event: "wallet.operation_prepared",
            resourceType: "wallet",
            resourceId: scope.walletId,
            data: { version: 1, operationId: operation.id, kind: operation.kind },
          });
          return operation;
        }),
      );
      return yield* responseFor(preparedOperation);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
