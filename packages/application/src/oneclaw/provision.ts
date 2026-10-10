import { Effect, Option, Predicate, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  CredentialId,
  Hex,
  SigningKeyId,
  WalletCreationError,
  WalletCustodyUnavailableError,
  type ActorId,
  type OrganizationId,
} from "@namera-ai/protocol";
import { OneClawAgentCredentialPayload, type SigningKeyInsert } from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";
import { OneClawService, OneClawOidcService } from "@namera-ai/wallet-provider-oneclaw";

import { Audit } from "#/audit/layer";

import { makeEnsureOneClawCustomer } from "./customer.js";

export const makeProvisionOneClawSigner = Effect.gen(function* () {
  const provider = yield* Effect.serviceOption(OneClawService);
  const identity = yield* Effect.serviceOption(OneClawOidcService);
  const ensureCustomer = yield* makeEnsureOneClawCustomer;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const audit = yield* Audit;

  return Effect.fn("application.oneclaw.provisionSigner")(function* (input: {
    organizationId: OrganizationId;
    actorId: ActorId;
    purpose: "wallet-root" | "session";
  }) {
    if (Option.isNone(provider) || Option.isNone(identity))
      return yield* new WalletCustodyUnavailableError({ code: "MANAGED_WALLETS_DISABLED" });
    const claw = provider.value;
    const authority = yield* ensureCustomer(input.organizationId).pipe(
      Effect.provideService(OneClawService, claw),
      Effect.provideService(OneClawOidcService, identity.value),
      Effect.mapError(
        (error) =>
          new WalletCreationError({
            code:
              Predicate.isTagged(error, "ProviderConnectionError") &&
              error.code === "RECOVERY_AMBIGUOUS"
                ? "PROVIDER_RECOVERY_REQUIRED"
                : "PROVIDER_SETUP_FAILED",
            namespace: "eip155",
          }),
      ),
    );
    const signingKeyId = Schema.decodeSync(SigningKeyId)(generateUniqueId());
    const credentialId = Schema.decodeSync(CredentialId)(generateUniqueId());
    // Once the one-time key is returned, interruption must not skip its durable save.
    const agent = yield* Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        const created = yield* restore(
          claw.agents.create({
            request: {
              signingKeyId,
              agentCredentialId: credentialId,
              connection: authority.connection,
            },
            authority,
            name: `namera-${signingKeyId}`,
          }),
        );
        const encryptedPayload = yield* crypto.encrypt({
          purpose: cryptoPurpose.providerCredential,
          value: JSON.stringify(
            Schema.encodeSync(OneClawAgentCredentialPayload)(created.credential),
          ),
        });
        yield* transaction.run(
          Effect.gen(function* () {
            yield* repository.core.credentials.insert({
              id: credentialId,
              organizationId: input.organizationId,
              type: "1claw-agent",
              data: { version: 1, agentId: created.credential.agentId },
              encryptedPayload,
            });
            yield* audit.organization({
              organizationId: input.organizationId,
              actorId: input.actorId,
              event: "provider_credential.saved",
              resourceType: "credential",
              resourceId: credentialId,
              data: { version: 1, type: "1claw-agent", renewed: false },
            });
          }),
        );
        return created;
      }),
    ).pipe(
      Effect.mapError(
        () => new WalletCreationError({ code: "PROVIDER_RECOVERY_REQUIRED", namespace: "eip155" }),
      ),
    );
    const customerAgent = { authority, agentId: agent.credential.agentId };
    const key = yield* claw.signingKeys
      .create(customerAgent)
      .pipe(
        Effect.mapError(
          () =>
            new WalletCreationError({ code: "PROVIDER_RECOVERY_REQUIRED", namespace: "eip155" }),
        ),
      );
    yield* claw.agents
      .setRawSigningEnabled({ ...customerAgent, enabled: true })
      .pipe(
        Effect.mapError(
          () =>
            new WalletCreationError({ code: "PROVIDER_RECOVERY_REQUIRED", namespace: "eip155" }),
        ),
      );
    const keys = yield* claw.signingKeys
      .list(customerAgent)
      .pipe(
        Effect.mapError(
          () =>
            new WalletCreationError({ code: "PROVIDER_RECOVERY_REQUIRED", namespace: "eip155" }),
        ),
      );
    if (
      keys.length !== 1 ||
      keys[0]?.id !== key.id ||
      keys[0]?.version !== key.version ||
      keys[0]?.publicKey !== key.publicKey ||
      keys[0]?.address !== key.address
    ) {
      return yield* new WalletCreationError({
        code: "PROVIDER_RECOVERY_REQUIRED",
        namespace: "eip155",
      });
    }
    return {
      signingKey: {
        id: signingKeyId,
        organizationId: input.organizationId,
        purpose: input.purpose,
        custody: "namera-managed",
        algorithm: "secp256k1",
        status: "active",
        publicKeyHex: Schema.decodeSync(Hex)(key.publicKey),
        credentialId,
        providerConnectionId: authority.connection.id,
        data: {
          version: 1,
          type: "1claw",
          chain: "ethereum",
          agentId: key.agentId,
          providerKeyId: key.id,
          keyVersion: key.version,
        },
      } satisfies SigningKeyInsert,
      connection: authority.connection,
      key,
    };
  });
});
