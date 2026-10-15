import { DateTime, Duration, Effect, Result, Schema } from "effect";
import * as HexEncoding from "effect/encoding/Hex";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { WalletTransactionError } from "@namera-ai/protocol";
import {
  PasskeyAuthenticationOptions,
  type PrepareWalletTransactionRequest,
  type PrepareWalletTransactionResponse,
} from "@namera-ai/protocol/dto";
import type { WalletOperation } from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { lockOrganizationBilling } from "#/billing/lock";
import { makeBillingMetering } from "#/billing/metering";

import { makeTransactionOwner, type WalletTransactionScope } from "./owner.js";
import { makeHashWalletTransaction } from "./request.js";

export const makePrepareWalletTransaction = Effect.gen(function* () {
  const repository = yield* Repository;
  const hashWalletTransaction = yield* makeHashWalletTransaction;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const passkeys = yield* Passkeys;
  const config = yield* AuthConfig;
  const audit = yield* Audit;
  const owners = yield* makeTransactionOwner;
  const billing = yield* makeBillingMetering;

  return Effect.fn("application.wallet.transactions.prepare")(
    function* (
      scope: WalletTransactionScope & {
        readonly idempotencyKey: string;
        readonly request: PrepareWalletTransactionRequest;
      },
    ) {
      const owner = yield* owners.load(scope);
      const requestHash = yield* hashWalletTransaction(scope.walletId, scope.request);
      const idempotency = {
        organizationId: scope.organizationId,
        actorId: scope.actorId,
        idempotencyKey: scope.idempotencyKey,
      };
      const responseFor = Effect.fnUntraced(function* (
        operation: WalletOperation,
      ): Effect.fn.Return<PrepareWalletTransactionResponse, WalletTransactionError> {
        if (operation.requestHash !== requestHash)
          return yield* new WalletTransactionError({ code: "IDEMPOTENCY_CONFLICT" });
        if (operation.status !== "awaiting-signature")
          return yield* new WalletTransactionError({ code: "OPERATION_UNAVAILABLE" });
        if (
          DateTime.toEpochMillis(operation.expiresAt) <= DateTime.toEpochMillis(yield* DateTime.now)
        )
          return yield* new WalletTransactionError({ code: "APPROVAL_EXPIRED" });
        yield* owners.check(operation).pipe(Effect.catchTag("DatabaseError", Effect.die));
        const priceQuote = yield* evm.billing.getNativeUsdcQuote();
        if (owner.type === "1claw")
          return {
            operationId: operation.id,
            namespace: "eip155",
            signingKeyId: operation.data.owner.signingKeyId,
            signing: { method: "server" },
            priceQuote,
            prepared: operation.data.prepared,
            expiresAt: operation.expiresAt,
          };
        const challenge = yield* evm.execution
          .ownerApprovalChallenge({ account: owner.account, prepared: operation.data.prepared })
          .pipe(Effect.mapError(() => new WalletTransactionError({ code: "PREPARATION_FAILED" })));
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
            Effect.mapError(() => new WalletTransactionError({ code: "PREPARATION_FAILED" })),
          );
        return {
          operationId: operation.id,
          namespace: "eip155",
          signingKeyId: operation.data.owner.signingKeyId,
          signing: { method: "passkey", options },
          priceQuote,
          prepared: operation.data.prepared,
          expiresAt: operation.expiresAt,
        };
      });
      const previous =
        yield* repository.core.walletOperation.findByActorAndIdempotencyKey(idempotency);
      if (previous) return yield* responseFor(previous);
      const prepared = yield* evm.execution
        .prepare({
          account: owner.account,
          chainId: scope.request.chainId,
          calls: scope.request.calls,
          sponsorship: scope.request.sponsor === false ? "none" : "alchemy-bso",
        })
        .pipe(Effect.mapError(() => new WalletTransactionError({ code: "PREPARATION_FAILED" })));
      yield* evm.execution.checkFunding(prepared);

      const preparedOperation = yield* transaction.run(
        Effect.gen(function* () {
          yield* lockOrganizationBilling(repository, scope.organizationId);
          yield* repository.core.wallet.findByIdForUpdate(scope.walletId, scope.organizationId);
          const current = yield* owners.load(scope);
          if (
            current.wallet.signingKey.id !== owner.wallet.signingKey.id ||
            current.wallet.signingKey.publicKeyHex !== owner.wallet.signingKey.publicKeyHex
          )
            return yield* new WalletTransactionError({ code: "OWNER_UNAVAILABLE" });
          const existing =
            yield* repository.core.walletOperation.findByActorAndIdempotencyKey(idempotency);
          if (existing) return existing;
          const chainScope = {
            organizationId: scope.organizationId,
            walletId: scope.walletId,
            chainId: scope.request.chainId,
          };
          if (
            (yield* repository.core.walletOperation.findActiveForWalletChain(chainScope)) ||
            (yield* repository.core.sessionKeyOperation.findActiveForWalletChain(chainScope))
          )
            return yield* new WalletTransactionError({ code: "OPERATION_BUSY" });
          const { operation } = yield* repository.core.walletOperation.insert({
            ...idempotency,
            walletId: scope.walletId,
            chainId: scope.request.chainId,
            kind: "transaction",
            requestHash,
            expiresAt: DateTime.addDuration(yield* DateTime.now, config.passkey.timeToLive),
            data: {
              version: 1,
              prepared,
              signed: null,
              broadcastAttempted: false,
              owner: {
                signingKeyId: owner.wallet.signingKey.id,
                publicKey: owner.wallet.signingKey.publicKeyHex,
              },
            },
          });
          if (prepared.billing.sponsorship) {
            yield* billing.reserve({
              organizationId: scope.organizationId,
              sourceType: "wallet-operation",
              sourceId: operation.id,
              expiresAt: operation.expiresAt,
              meterKey: "gas-sponsorship",
              amount: prepared.billing.sponsorship.reservationAmountMicroUsd,
            });
          }
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
