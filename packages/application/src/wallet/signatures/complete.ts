import { DateTime, Duration, Effect, Result, Schema } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as HexEncoding from "effect/encoding/Hex";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { WalletSignatureError } from "@namera-ai/protocol";
import {
  CompleteWalletSignatureResponse,
  type CompleteWalletSignatureRequest,
} from "@namera-ai/protocol/dto";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { makeLoadOneClawOwner } from "#/oneclaw/owner";

import { makeWalletSignatureOwner, type WalletSignatureScope } from "./owner.js";

export const makeCompleteWalletSignature = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const crypto = yield* CryptoService;
  const owners = yield* makeWalletSignatureOwner;
  const evm = yield* Evm;
  const passkeys = yield* Passkeys;
  const config = yield* AuthConfig;
  const loadSigner = yield* makeLoadOneClawOwner;
  const audit = yield* Audit;
  return Effect.fn("application.wallet.signatures.complete")(
    function* (input: WalletSignatureScope & { readonly request: CompleteWalletSignatureRequest }) {
      const scope = {
        organizationId: input.organizationId,
        actorId: input.actorId,
        id: input.request.operationId,
      };
      const operation = yield* repository.core.walletSignatureOperation.findById(scope);
      if (
        !operation ||
        operation.walletId !== input.walletId ||
        operation.request.namespace !== input.request.namespace
      )
        return yield* new WalletSignatureError({ code: "OPERATION_UNAVAILABLE" });
      const owner = yield* owners.check(operation);
      const purpose = `${cryptoPurpose.walletSignatureResult}:${operation.organizationId}:${operation.actorId}:${operation.id}:${operation.requestHash}`;
      if (owner.type === "1claw" && input.request.response)
        return yield* new WalletSignatureError({ code: "APPROVAL_INVALID" });
      if (operation.status === "succeeded" && operation.encryptedResult) {
        const json = yield* crypto
          .decrypt({ purpose, value: operation.encryptedResult })
          .pipe(Effect.orDie);
        return yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(CompleteWalletSignatureResponse),
        )(json).pipe(Effect.orDie);
      }
      const now = yield* DateTime.now;
      if (DateTime.toEpochMillis(operation.expiresAt) <= DateTime.toEpochMillis(now))
        return yield* new WalletSignatureError({ code: "APPROVAL_EXPIRED" });
      const leaseToken = generateUniqueId();
      yield* Effect.acquireRelease(
        repository.core.walletSignatureOperation
          .claim({
            ...scope,
            leaseToken,
            now,
            leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
          })
          .pipe(
            Effect.flatMap((claimed) =>
              claimed
                ? Effect.void
                : Effect.fail(new WalletSignatureError({ code: "OPERATION_BUSY" })),
            ),
          ),
        () =>
          repository.core.walletSignatureOperation
            .release({ ...scope, leaseToken })
            .pipe(Effect.orDie),
      );
      const signed = yield* Effect.gen(function* () {
        if (owner.type === "1claw") {
          const signer = yield* loadSigner(owner.wallet).pipe(
            Effect.mapError(() => new WalletSignatureError({ code: "OWNER_UNAVAILABLE" })),
          );
          const signature = yield* evm.ownerSignatures
            .complete({
              ...operation.request,
              account: {
                wallet: owner.wallet.wallet.data,
                owner: { validatorType: "ecdsa_secp256k1", account: signer },
              },
            })
            .pipe(Effect.mapError(() => new WalletSignatureError({ code: "SIGNING_FAILED" })));
          return { signature, assertion: undefined };
        }
        if (!input.request.response)
          return yield* new WalletSignatureError({ code: "APPROVAL_INVALID" });
        const challenge = yield* evm.ownerSignatures
          .prepare({ ...operation.request, account: owner.account })
          .pipe(Effect.mapError(() => new WalletSignatureError({ code: "PREPARATION_FAILED" })));
        if (!challenge) return yield* new WalletSignatureError({ code: "APPROVAL_INVALID" });
        const assertion = yield* passkeys
          .verifyAuthentication({
            response: input.request.response,
            expectedChallenge: Base64Url.encode(
              Result.getOrThrow(HexEncoding.decode(challenge.slice(2))),
            ),
            expectedOrigin: config.dashboardPublicOrigin.origin,
            expectedRpId: owner.credential.rpId,
            credentialId: owner.credential.credentialId,
            publicKeyHex: owner.wallet.signingKey.publicKeyHex,
            signCount: owner.credential.signCount,
          })
          .pipe(Effect.mapError(() => new WalletSignatureError({ code: "APPROVAL_INVALID" })));
        const signature = yield* evm.ownerSignatures
          .complete({ ...operation.request, account: owner.account, assertion })
          .pipe(Effect.mapError(() => new WalletSignatureError({ code: "SIGNING_FAILED" })));
        return { signature, assertion };
      }).pipe(
        Effect.timeout(Duration.seconds(90)),
        Effect.catchTag("TimeoutError", () => new WalletSignatureError({ code: "SIGNING_FAILED" })),
      );
      const result: CompleteWalletSignatureResponse = {
        namespace: "eip155",
        operationId: operation.id,
        walletId: operation.walletId,
        chainId: operation.request.chainId,
        type: operation.request.type,
        account: owner.wallet.wallet.data.address,
        signature: signed.signature,
      };
      const encryptedResult = yield* crypto.encrypt({
        purpose,
        value: JSON.stringify(Schema.encodeSync(CompleteWalletSignatureResponse)(result)),
      });
      yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.core.wallet.findByIdForUpdate(input.walletId, input.organizationId);
          yield* repository.core.signingKey.findById(
            operation.signingKeyId,
            input.organizationId,
            true,
          );
          if (owner.wallet.signingKey.providerConnectionId)
            yield* repository.core.providerConnections.findByIdForUpdate(
              owner.wallet.signingKey.providerConnectionId,
              input.organizationId,
            );
          yield* owners.check(operation);
          if (owner.type === "passkey" && signed.assertion) {
            const advanced = yield* repository.core.signingKey.advancePasskeyCounter({
              id: operation.signingKeyId,
              organizationId: input.organizationId,
              credentialId: owner.credential.credentialId,
              expectedCounter: owner.credential.signCount,
              nextCounter: signed.assertion.signCount,
            });
            if (!advanced) return yield* new WalletSignatureError({ code: "APPROVAL_INVALID" });
          }
          const accepted = yield* repository.core.walletSignatureOperation.succeed({
            ...scope,
            leaseToken,
            now: yield* DateTime.now,
            encryptedResult,
          });
          if (!accepted) return yield* new WalletSignatureError({ code: "APPROVAL_EXPIRED" });
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "wallet.signature_created",
            resourceType: "wallet",
            resourceId: input.walletId,
            data: {
              version: 1,
              operationId: operation.id,
              namespace: operation.request.namespace,
              type: operation.request.type,
              chainId: operation.request.chainId,
            },
          });
        }),
      );
      return result;
    },
    Effect.scoped,
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
