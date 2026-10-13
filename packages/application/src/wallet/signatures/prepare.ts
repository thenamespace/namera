import { DateTime, Duration, Effect, Result, Schema } from "effect";
import * as HexEncoding from "effect/encoding/Hex";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { WalletSignatureError, type DatabaseError } from "@namera-ai/protocol";
import {
  PasskeyAuthenticationOptions,
  PrepareWalletSignatureRequest,
  type PrepareWalletSignatureResponse,
} from "@namera-ai/protocol/dto";
import type { WalletSignatureOperation } from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";

import { makeWalletSignatureOwner, type WalletSignatureScope } from "./owner.js";

export const makePrepareWalletSignature = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const owners = yield* makeWalletSignatureOwner;
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const passkeys = yield* Passkeys;
  const config = yield* AuthConfig;
  const audit = yield* Audit;
  return Effect.fn("application.wallet.signatures.prepare")(
    function* (
      input: WalletSignatureScope & {
        readonly idempotencyKey: string;
        readonly request: PrepareWalletSignatureRequest;
      },
    ) {
      const owner = yield* owners.load(input);
      const requestHash = yield* crypto.hash({
        purpose: cryptoPurpose.walletSignatureRequest,
        value: JSON.stringify({
          walletId: input.walletId,
          request: Schema.encodeSync(PrepareWalletSignatureRequest)(input.request),
        }),
      });
      const responseFor = Effect.fnUntraced(function* (
        operation: WalletSignatureOperation,
      ): Effect.fn.Return<PrepareWalletSignatureResponse, WalletSignatureError | DatabaseError> {
        if (operation.requestHash !== requestHash)
          return yield* new WalletSignatureError({ code: "IDEMPOTENCY_CONFLICT" });
        const current = yield* owners.check(operation);
        const remaining =
          DateTime.toEpochMillis(operation.expiresAt) - DateTime.toEpochMillis(yield* DateTime.now);
        if (remaining <= 0) return yield* new WalletSignatureError({ code: "APPROVAL_EXPIRED" });
        if (operation.status !== "prepared")
          return yield* new WalletSignatureError({ code: "OPERATION_UNAVAILABLE" });
        const challenge = yield* evm.ownerSignatures
          .prepare({ ...operation.request, account: current.account })
          .pipe(Effect.mapError(() => new WalletSignatureError({ code: "PREPARATION_FAILED" })));
        const common = {
          namespace: "eip155" as const,
          operationId: operation.id,
          walletId: operation.walletId,
          signingKeyId: operation.signingKeyId,
          account: current.wallet.wallet.data.address,
          request: operation.request,
          expiresAt: operation.expiresAt,
        };
        if (current.type === "1claw") return { ...common, signing: { method: "server" } };
        if (!challenge) return yield* new WalletSignatureError({ code: "PREPARATION_FAILED" });
        const options = yield* passkeys
          .generateAuthenticationOptions({
            rpId: current.credential.rpId,
            credentialId: current.credential.credentialId,
            challenge: new Uint8Array(Result.getOrThrow(HexEncoding.decode(challenge.slice(2)))),
            timeoutMs: Math.min(remaining, Duration.toMillis(config.passkey.timeToLive)),
          })
          .pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(PasskeyAuthenticationOptions)),
            Effect.mapError(() => new WalletSignatureError({ code: "PREPARATION_FAILED" })),
          );
        return { ...common, signing: { method: "passkey", options } };
      });
      const prior = yield* repository.core.walletSignatureOperation.findByIdempotencyKey(input);
      if (prior) return yield* responseFor(prior);
      // Validate reconstruction and payload before creating an approval record. This never signs.
      yield* evm.ownerSignatures
        .prepare({ ...input.request, account: owner.account })
        .pipe(Effect.mapError(() => new WalletSignatureError({ code: "PREPARATION_FAILED" })));
      const operation = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.core.wallet.findByIdForUpdate(input.walletId, input.organizationId);
          const current = yield* owners.load(input);
          if (current.binding !== owner.binding)
            return yield* new WalletSignatureError({ code: "OWNER_UNAVAILABLE" });
          const existing =
            yield* repository.core.walletSignatureOperation.findByIdempotencyKey(input);
          if (existing) return existing;
          const inserted = yield* repository.core.walletSignatureOperation.insert({
            organizationId: input.organizationId,
            actorId: input.actorId,
            walletId: input.walletId,
            signingKeyId: current.wallet.signingKey.id,
            ownerBinding: current.binding,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            request: input.request,
            expiresAt: DateTime.addDuration(yield* DateTime.now, config.passkey.timeToLive),
          });
          if (!inserted) {
            const raced =
              yield* repository.core.walletSignatureOperation.findByIdempotencyKey(input);
            if (!raced) return yield* new WalletSignatureError({ code: "OPERATION_UNAVAILABLE" });
            return raced;
          }
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "wallet.signature_prepared",
            resourceType: "wallet",
            resourceId: input.walletId,
            data: {
              version: 1,
              operationId: inserted.id,
              namespace: input.request.namespace,
              type: input.request.type,
              chainId: input.request.chainId,
            },
          });
          return inserted;
        }),
      );
      return yield* responseFor(operation);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
