import { Effect, Redacted, Result, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { CredentialId, ProviderConnectionError } from "@namera-ai/protocol";
import {
  OneClawCustomerAuthorizationPayload,
  type OneClawCustomerAuthority,
} from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";
import { OneClawService } from "@namera-ai/wallet-provider-oneclaw";

import { Audit } from "#/audit/layer";

// Runs under the connection's existing setup lease, including its heartbeat.
export const makeEnsureCustomerAuthorization = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const crypto = yield* CryptoService;
  const audit = yield* Audit;

  return Effect.fn("application.oneclaw.ensureCustomerAuthorization")(function* (
    authority: OneClawCustomerAuthority,
    leaseToken: string,
  ) {
    const claw = yield* OneClawService;
    const { connection } = authority;
    if (connection.data.oidcSubject !== `namera:org:${connection.organizationId}`)
      return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
    let credential = yield* repository.core.credentials.findCustomerAuthorization(
      connection.id,
      connection.organizationId,
    );
    if (!credential) {
      const id = CredentialId.make(generateUniqueId());
      const payload: OneClawCustomerAuthorizationPayload = {
        version: 1,
        credentialId: id,
        organizationId: connection.organizationId,
        providerConnectionId: connection.id,
        providerAppId: connection.providerAppId,
        externalConnectionId: authority.payload.externalConnectionId,
        customerId: authority.payload.customerId,
        password: Redacted.make(`Aa1!${yield* crypto.randomToken(48)}`),
      };
      const encryptedPayload = yield* crypto.encrypt({
        purpose: `${cryptoPurpose.providerCredential}:authorization:${connection.organizationId}:${id}`,
        value: JSON.stringify(Schema.encodeSync(OneClawCustomerAuthorizationPayload)(payload)),
      });
      credential = yield* transaction.run(
        Effect.gen(function* () {
          if (
            !(yield* repository.core.providerConnections.renewLease({
              id: connection.id,
              organizationId: connection.organizationId,
              leaseToken,
            }))
          )
            return yield* new ProviderConnectionError({ code: "PROVISIONING_INCOMPLETE" });
          const saved = yield* repository.core.credentials.insert({
            id,
            organizationId: connection.organizationId,
            type: "1claw-customer-authorization",
            data: {
              version: 1,
              providerConnectionId: connection.id,
              providerAppId: connection.providerAppId,
              externalConnectionId: payload.externalConnectionId,
              customerId: payload.customerId,
              status: "pending",
            },
            encryptedPayload,
          });
          yield* audit.organization(
            {
              organizationId: connection.organizationId,
              actorId: null,
              event: "provider_credential.saved",
              resourceType: "credential",
              resourceId: id,
              data: { version: 1, type: "1claw-customer-authorization", renewed: false },
            },
            { source: "system" },
          );
          return saved;
        }),
      );
    }
    if (
      credential.type !== "1claw-customer-authorization" ||
      credential.data.status === "recovery_required"
    )
      return yield* new ProviderConnectionError({ code: "RECOVERY_AMBIGUOUS" });
    const cleartext = yield* crypto.decrypt({
      purpose: `${cryptoPurpose.providerCredential}:authorization:${connection.organizationId}:${credential.id}`,
      value: credential.encryptedPayload,
    });
    const payload = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(OneClawCustomerAuthorizationPayload),
    )(cleartext).pipe(
      Effect.mapError(() => new ProviderConnectionError({ code: "IDENTITY_MISMATCH" })),
    );
    if (
      payload.credentialId !== credential.id ||
      payload.organizationId !== connection.organizationId ||
      payload.providerConnectionId !== connection.id ||
      payload.providerAppId !== connection.providerAppId ||
      payload.externalConnectionId !== authority.payload.externalConnectionId ||
      payload.customerId !== authority.payload.customerId ||
      credential.data.providerConnectionId !== payload.providerConnectionId ||
      credential.data.providerAppId !== payload.providerAppId ||
      credential.data.externalConnectionId !== payload.externalConnectionId ||
      credential.data.customerId !== payload.customerId
    )
      return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
    if (credential.data.status === "ready")
      return { password: payload.password, passwordSet: false };

    const setStatus = (status: "ready" | "recovery_required") =>
      transaction.run(
        Effect.gen(function* () {
          if (
            !(yield* repository.core.credentials.setAuthorizationStatus({
              id: payload.credentialId,
              organizationId: connection.organizationId,
              leaseToken,
              status,
            }))
          )
            return yield* new ProviderConnectionError({ code: "PROVISIONING_INCOMPLETE" });
          yield* audit.organization(
            {
              organizationId: connection.organizationId,
              actorId: null,
              event: "provider_credential.saved",
              resourceType: "credential",
              resourceId: payload.credentialId,
              data: {
                version: 1,
                type: "1claw-customer-authorization",
                renewed: true,
                authorizationStatus: status,
              },
            },
            { source: "system" },
          );
        }),
      );

    // Initial-password setup never overwrites a password. A previous request may
    // have succeeded remotely; verify the same durable secret after a rejection.
    const setup = yield* claw.customers
      .setPassword({ authority, password: payload.password })
      .pipe(Effect.result);
    if (Result.isFailure(setup)) {
      if (setup.failure.httpStatus !== 400 && setup.failure.httpStatus !== 409)
        return yield* setup.failure;
      const verified = yield* claw.customers
        .verifyPassword({ authority, password: payload.password })
        .pipe(Effect.result);
      if (Result.isFailure(verified)) {
        if (
          [
            "UNAUTHENTICATED",
            "FORBIDDEN",
            "INVALID_REQUEST",
            "IDENTITY_MISMATCH",
            "INVALID_RESPONSE",
          ].includes(verified.failure.code)
        ) {
          yield* setStatus("recovery_required");
        }
        return yield* verified.failure;
      }
    }
    yield* setStatus("ready");
    return { password: payload.password, passwordSet: true };
  });
});
