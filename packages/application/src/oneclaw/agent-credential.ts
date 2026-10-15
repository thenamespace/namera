import { Effect, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { ProviderConnectionError } from "@namera-ai/protocol";
import { OneClawAgentCredentialPayload, type SigningKey } from "@namera-ai/protocol/model";

export const makeLoadOneClawAgentCredential = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;

  return Effect.fnUntraced(function* (
    key: Pick<SigningKey, "organizationId" | "providerConnectionId"> & {
      readonly credentialId: NonNullable<SigningKey["credentialId"]>;
    },
    agentId: string,
    appId: string,
  ) {
    // Recheck on every signature; a prepared operation must not retain revoked credentials.
    const connection = yield* repository.core.providerConnections.findByOrganization(
      key.organizationId,
      appId,
    );
    if (
      !connection ||
      connection.id !== key.providerConnectionId ||
      connection.status !== "ready"
    ) {
      return yield* new ProviderConnectionError({ code: "CONNECTION_REVOKED" });
    }

    const credential = yield* repository.core.credentials.findById(
      key.credentialId,
      key.organizationId,
    );
    if (!credential || credential.type !== "1claw-agent" || credential.data.agentId !== agentId) {
      return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
    }

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
      payload.agentId !== agentId
    ) {
      return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
    }

    return payload;
  });
});
