import { Config, Effect, Option, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { createSecp256k1OwnerAccount } from "@namera-ai/evm";
import { ProviderConnectionError } from "@namera-ai/protocol";
import { OneClawAgentCredentialPayload, type SigningKey } from "@namera-ai/protocol/model";
import { OneClawService } from "@namera-ai/wallet-provider-oneclaw";

/** Public identity only; excludes timestamps so reads do not invalidate a preparation. */
export const sessionSignerBinding = (key: SigningKey): string =>
  JSON.stringify({
    id: key.id,
    organizationId: key.organizationId,
    purpose: key.purpose,
    custody: key.custody,
    algorithm: key.algorithm,
    publicKeyHex: key.publicKeyHex,
    credentialId: key.credentialId,
    providerConnectionId: key.providerConnectionId,
    data: key.data,
  });

export const makeLoadOneClawSessionSigner = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const provider = yield* Effect.serviceOption(OneClawService);
  return Effect.fnUntraced(function* (key: SigningKey) {
    if (
      Option.isNone(provider) ||
      key.purpose !== "session" ||
      key.status !== "active" ||
      key.custody !== "namera-managed" ||
      key.algorithm !== "secp256k1" ||
      key.data.type !== "1claw" ||
      key.data.chain !== "ethereum" ||
      !key.providerConnectionId
    )
      return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
    const claw = provider.value;
    const data = key.data;
    const connectionId = key.providerConnectionId;
    const appId = yield* Config.String("ONECLAW_PLATFORM_APP_ID");
    const sign = Effect.fnUntraced(function* (digest: Uint8Array) {
      const fresh = yield* repository.core.signingKey.findById(key.id, key.organizationId);
      if (
        !fresh ||
        fresh.status !== "active" ||
        sessionSignerBinding(fresh) !== sessionSignerBinding(key)
      )
        return yield* new ProviderConnectionError({ code: "CONNECTION_REVOKED" });
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
          address: account.address,
          version: data.keyVersion,
        },
      });
    });
    const account = createSecp256k1OwnerAccount({
      publicKey: key.publicKeyHex,
      signatureEncoding: "recoverable",
      sign: (digest) => Effect.runPromise(sign(digest)),
    });
    return account;
  });
});
