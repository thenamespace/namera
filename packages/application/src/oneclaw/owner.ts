import { Config, Effect, Option, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, type WalletView } from "@namera-ai/database";
import { createSecp256k1OwnerAccount } from "@namera-ai/evm";
import { ProviderConnectionError } from "@namera-ai/protocol";
import { OneClawAgentCredentialPayload } from "@namera-ai/protocol/model";
import { OneClawService } from "@namera-ai/wallet-provider-oneclaw";

export const makeLoadOneClawOwner = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const provider = yield* Effect.serviceOption(OneClawService);
  return Effect.fnUntraced(function* (view: WalletView) {
    const key = view.signingKey;
    const wallet = view.wallet;
    if (
      Option.isNone(provider) ||
      key.data.type !== "1claw" ||
      key.data.chain !== "ethereum" ||
      key.algorithm !== "secp256k1" ||
      key.custody !== "namera-managed" ||
      !key.providerConnectionId ||
      key.purpose !== "wallet-root" ||
      key.status !== "active" ||
      wallet.status !== "active" ||
      wallet.organizationId !== key.organizationId ||
      wallet.signingKeyId !== key.id ||
      wallet.data.validatorType !== "ecdsa_secp256k1" ||
      wallet.data.accountMode !== "factory"
    ) {
      return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
    }
    const claw = provider.value;
    const data = key.data;
    const ownerAddress = wallet.data.ownerAddress;
    const connectionId = key.providerConnectionId;
    const appId = yield* Config.String("ONECLAW_PLATFORM_APP_ID");
    const sign = Effect.fnUntraced(function* (digest: Uint8Array) {
      const fresh = yield* repository.core.wallet.findById(wallet.id, wallet.organizationId);
      if (
        !fresh ||
        fresh.wallet.status !== "active" ||
        fresh.signingKey.status !== "active" ||
        fresh.signingKey.id !== key.id ||
        fresh.signingKey.credentialId !== key.credentialId ||
        fresh.signingKey.providerConnectionId !== connectionId ||
        fresh.signingKey.publicKeyHex !== key.publicKeyHex ||
        fresh.signingKey.data.type !== "1claw" ||
        fresh.signingKey.data.agentId !== data.agentId ||
        fresh.signingKey.data.providerKeyId !== data.providerKeyId ||
        fresh.signingKey.data.keyVersion !== data.keyVersion
      ) {
        return yield* new ProviderConnectionError({ code: "CONNECTION_REVOKED" });
      }
      const connection = yield* repository.core.providerConnections.findByOrganization(
        key.organizationId,
        appId,
      );
      if (!connection || connection.id !== connectionId || connection.status !== "ready")
        return yield* new ProviderConnectionError({ code: "CONNECTION_REVOKED" });
      const credential = yield* repository.core.credentials.findById(
        key.credentialId,
        key.organizationId,
      );
      if (
        !credential ||
        credential.type !== "1claw-agent" ||
        credential.data.agentId !== data.agentId
      )
        return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
      const cleartext = yield* crypto.decrypt({
        purpose: cryptoPurpose.providerCredential,
        value: credential.encryptedPayload,
      });
      const payload = yield* Schema.decodeUnknownEffect(
        Schema.fromJsonString(OneClawAgentCredentialPayload),
      )(cleartext).pipe(
        Effect.mapError(() => new ProviderConnectionError({ code: "IDENTITY_MISMATCH" })),
      );
      if (
        payload.organizationId !== key.organizationId ||
        payload.credentialId !== key.credentialId ||
        payload.agentId !== data.agentId
      )
        return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
      return yield* claw.signing.signDigest({
        credential: payload,
        digest,
        key: {
          id: data.providerKeyId,
          agentId: data.agentId,
          chain: "ethereum",
          curve: "secp256k1",
          publicKey: key.publicKeyHex,
          address: ownerAddress,
          version: data.keyVersion,
        },
      });
    });
    return createSecp256k1OwnerAccount({
      publicKey: key.publicKeyHex,
      signatureEncoding: "recoverable",
      sign: (digest) => Effect.runPromise(sign(digest)),
    });
  });
});
