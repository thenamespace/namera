import { DateTime, Effect, Metric, Option, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm, getChainDataByChainId, createSecp256k1OwnerAccount } from "@namera-ai/evm";
import {
  Hex,
  PasskeyVerificationError,
  SigningKeyId,
  WalletCreationError,
  WalletCustodyUnavailableError,
  type ActorId,
  type OrganizationId,
  type UserId,
} from "@namera-ai/protocol";
import type { CreateWalletRequest } from "@namera-ai/protocol/dto";
import type { SigningKeyInsert } from "@namera-ai/protocol/model";
import { walletCreationDuration, walletCreationResults } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";
import { GcpService } from "@namera-ai/wallet-provider-gcp";
import { OneClawService } from "@namera-ai/wallet-provider-oneclaw";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import {
  enforceLocalWalletLimit,
  enforceOneClawWalletLimit,
  enforceWalletLimit,
  lockOrganizationBilling,
  makeBillingPeriods,
} from "#/billing/index";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";
import { dashboardEmailLink } from "#/notification/email-link";
import { makeProvisionOneClawSigner } from "#/oneclaw/provision";

import { walletPolicy } from "./data.js";
import { makeVerifyPasskeyRegistration } from "./passkey-registration.js";

export const makeCreateWallet = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const audit = yield* Audit;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const periods = yield* makeBillingPeriods;
  const gcp = yield* GcpService;
  const createNotification = yield* makeCreateNotification;
  const verifyPasskeyRegistration = yield* makeVerifyPasskeyRegistration;
  const provisionOneClaw = yield* makeProvisionOneClawSigner;
  const oneClaw = yield* Effect.serviceOption(OneClawService);

  return Effect.fn("application.wallet.create")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly userId: UserId;
    readonly request: CreateWalletRequest;
  }) {
    const requestedOwner = input.request.owner;
    if (
      requestedOwner.type === "namera-managed" &&
      requestedOwner.provider === "1claw" &&
      Option.isNone(oneClaw)
    ) {
      return yield* new WalletCustodyUnavailableError({ code: "MANAGED_WALLETS_DISABLED" });
    }
    const custody = requestedOwner.type === "passkey" ? "local" : "namera-managed";
    const protectionLevel =
      requestedOwner.type === "namera-managed" && requestedOwner.provider !== "1claw"
        ? requestedOwner.protectionLevel
        : "not-applicable";
    const creationResults = Metric.withAttributes(walletCreationResults, {
      namespace: input.request.namespace,
      implementation: "alchemy-modular-v2",
      custody,
      protection_level: protectionLevel,
    });

    const initialLimitCheck =
      requestedOwner.type === "passkey"
        ? enforceLocalWalletLimit(repository, input.organizationId, periods)
        : requestedOwner.provider === "1claw"
          ? enforceOneClawWalletLimit(repository, input.organizationId, periods)
          : enforceWalletLimit(
              repository,
              input.organizationId,
              requestedOwner.protectionLevel,
              periods,
            );
    yield* initialLimitCheck.pipe(
      Effect.tapErrorTag("BillingError", () =>
        Metric.update(Metric.withAttributes(creationResults, { result: "limit_exceeded" }), 1),
      ),
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const signingKeyId = Schema.decodeSync(SigningKeyId)(generateUniqueId());
    const preparedOwner = yield* requestedOwner.type === "passkey"
      ? Effect.gen(function* () {
          const passkey = yield* verifyPasskeyRegistration({
            verificationId: requestedOwner.verificationId,
            organizationId: input.organizationId,
            userId: input.userId,
            response: requestedOwner.response,
          });
          const publicKeyHex = Schema.decodeSync(Hex)(passkey.publicKeyHex);
          return {
            publicKeyHex,
            signingKey: {
              id: signingKeyId,
              organizationId: input.organizationId,
              purpose: "wallet-root",
              custody: "local",
              algorithm: "p256",
              publicKeyHex,
              status: "active",
              data: {
                version: 1,
                type: "passkey",
                credentialId: passkey.credentialId,
                rpId: passkey.rpId,
                transports: [...passkey.transports],
                signCount: passkey.signCount,
              },
            } satisfies SigningKeyInsert,
          } as const;
        })
      : requestedOwner.provider === "1claw"
        ? Effect.gen(function* () {
            const prepared = yield* provisionOneClaw({ ...input, purpose: "wallet-root" });
            return {
              signingKey: prepared.signingKey,
              publicKeyHex: prepared.signingKey.publicKeyHex,
            };
          })
        : Effect.gen(function* () {
            const createdKey = yield* gcp
              .createKey({
                id: signingKeyId,
                algorithm: walletPolicy.eip155.algorithm,
                protectionLevel: requestedOwner.protectionLevel,
              })
              .pipe(
                Effect.tapError(() =>
                  Metric.update(
                    Metric.withAttributes(creationResults, { result: "key_failed" }),
                    1,
                  ),
                ),
                Effect.mapError(
                  () =>
                    new WalletCreationError({
                      code: "KEY_CREATION_FAILED",
                      namespace: input.request.namespace,
                    }),
                ),
              );
            const data = {
              version: 1 as const,
              type: "gcp-kms" as const,
              protectionLevel: createdKey.protectionLevel,
              providerAlgorithm: createdKey.data.providerAlgorithm,
              keyVersionName: createdKey.data.keyVersionName,
            };
            return {
              publicKeyHex: createdKey.publicKeyHex,
              signingKey: {
                id: signingKeyId,
                organizationId: input.organizationId,
                purpose: "wallet-root",
                custody: "namera-managed",
                algorithm: createdKey.algorithm,
                publicKeyHex: createdKey.publicKeyHex,
                status: "active",
                data,
              } satisfies SigningKeyInsert,
            } as const;
          });

    const account = yield* evm
      .createAccount(
        preparedOwner.signingKey.data.type === "1claw"
          ? {
              chainId: walletPolicy.eip155.derivationChainId,
              accountMode: "factory",
              entryPointVersion: walletPolicy.eip155.alchemyModularV2.entryPointVersion,
              salt: walletPolicy.eip155.alchemyModularV2.salt,
              owner: {
                validatorType: "ecdsa_secp256k1",
                account: createSecp256k1OwnerAccount({
                  publicKey: preparedOwner.publicKeyHex,
                  sign: async () => {
                    throw new Error("Account derivation must not sign");
                  },
                }),
              },
            }
          : {
              chainId: walletPolicy.eip155.derivationChainId,
              entryPointVersion: walletPolicy.eip155.alchemyModularV2.entryPointVersion,
              salt: walletPolicy.eip155.alchemyModularV2.salt,
              entityId: walletPolicy.eip155.alchemyModularV2.entityId,
              owner: { validatorType: "webauthn_p256", publicKey: preparedOwner.publicKeyHex },
            },
      )
      .pipe(
        Effect.tapError(() =>
          Metric.update(Metric.withAttributes(creationResults, { result: "account_failed" }), 1),
        ),
        Effect.mapError(
          () =>
            new WalletCreationError({
              code: "ACCOUNT_CREATION_FAILED",
              namespace: input.request.namespace,
            }),
        ),
      );

    const derivationChain = getChainDataByChainId(walletPolicy.eip155.derivationChainId);
    const blockExplorerUrl = derivationChain?.chain.blockExplorers?.default.url;
    if (blockExplorerUrl === undefined) {
      return yield* Effect.die("Wallet derivation chain block explorer is missing");
    }
    const addressUrl = `${blockExplorerUrl.replace(/\/$/, "")}/address/${account.address}`;
    const ownership =
      preparedOwner.signingKey.custody === "local"
        ? "User-owned passkey"
        : preparedOwner.signingKey.data.type === "1claw"
          ? "Namera managed · 1Claw"
          : `Namera managed · ${preparedOwner.signingKey.data.protectionLevel === "hsm" ? "HSM" : "Software"}`;

    const result = yield* transaction
      .run(
        Effect.gen(function* () {
          yield* lockOrganizationBilling(repository, input.organizationId);
          if (requestedOwner.type === "passkey") {
            yield* enforceLocalWalletLimit(repository, input.organizationId, periods);
            const consumed = yield* repository.auth.verification.consume({
              verificationId: requestedOwner.verificationId,
              consumedAt: yield* DateTime.now,
              maxAttempts: 3,
            });
            if (consumed === undefined) {
              return yield* new PasskeyVerificationError({ code: "REGISTRATION_NOT_FOUND" });
            }
          } else if (requestedOwner.provider === "1claw") {
            yield* enforceOneClawWalletLimit(repository, input.organizationId, periods);
            const key = preparedOwner.signingKey;
            if (key.data.type !== "1claw" || !("providerConnectionId" in key))
              return yield* Effect.die("Invalid 1Claw signer binding");
            const credential = yield* repository.core.credentials.findById(
              key.credentialId,
              input.organizationId,
            );
            if (
              !credential ||
              credential.type !== "1claw-agent" ||
              credential.data.agentId !== key.data.agentId
            ) {
              return yield* new WalletCreationError({
                code: "WALLET_PERSISTENCE_FAILED",
                namespace: input.request.namespace,
              });
            }
            const connection = yield* repository.core.providerConnections.findByIdForUpdate(
              key.providerConnectionId,
              input.organizationId,
            );
            if (!connection || connection.status !== "ready")
              return yield* new WalletCreationError({
                code: "WALLET_PERSISTENCE_FAILED",
                namespace: input.request.namespace,
              });
          } else {
            yield* enforceWalletLimit(
              repository,
              input.organizationId,
              requestedOwner.protectionLevel,
              periods,
            );
          }

          const signingKey = yield* repository.core.signingKey.insert(preparedOwner.signingKey);
          const wallet = yield* repository.core.wallet.insert({
            organizationId: input.organizationId,
            signingKeyId: signingKey.id,
            metadata: input.request.metadata,
            status: "active",
            createdByActorId: input.actorId,
            namespace: input.request.namespace,
            data: account,
          });
          const accountEvent = {
            implementation: account.implementation,
            implementationVersion: account.modularAccountVersion,
            entryPointVersion: account.entryPointVersion,
          } as const;
          const signingKeyEvent = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "signing_key.created",
            resourceType: "signing-key",
            resourceId: signingKey.id,
            data: { version: 1, custody: signingKey.custody },
          });
          const walletEvent = yield* audit.organization(
            {
              organizationId: input.organizationId,
              actorId: input.actorId,
              event: "wallet.created",
              resourceType: "wallet",
              resourceId: wallet.id,
              data: {
                version: 1,
                signingKeyId: signingKey.id,
                namespace: wallet.namespace,
                address: account.address,
                custody: signingKey.custody,
                account: accountEvent,
              },
            },
            { correlationId: signingKeyEvent.correlationId },
          );

          const organization = yield* repository.auth.organization.findById(input.organizationId);
          if (organization === undefined) {
            return yield* Effect.die("Wallet organization disappeared during creation");
          }
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.organizationId,
          );
          const now = yield* DateTime.now;
          const notificationData =
            preparedOwner.signingKey.custody === "local"
              ? {
                  version: 1 as const,
                  address: account.address,
                  implementation: account.implementation,
                  custody: "local" as const,
                }
              : preparedOwner.signingKey.data.type === "1claw"
                ? {
                    version: 1 as const,
                    address: account.address,
                    implementation: account.implementation,
                    custody: "namera-managed" as const,
                    provider: "1claw" as const,
                  }
                : {
                    version: 1 as const,
                    address: account.address,
                    implementation: account.implementation,
                    custody: "namera-managed" as const,
                    protectionLevel: preparedOwner.signingKey.data.protectionLevel,
                  };
          yield* createNotification({
            organizationId: input.organizationId,
            actorId: input.actorId,
            type: "wallet.created",
            resourceType: "wallet",
            resourceId: wallet.id,
            data: notificationData,
            idempotencyKey: `notification:wallet.created:${wallet.id}`,
            correlationId: walletEvent.correlationId,
            expiresAt: null,
            recipients: members
              .filter(({ organizationRole }) =>
                organizationRole.permissions.includes("wallet:read"),
              )
              .map(({ user }) => ({
                userId: user.id,
                email: {
                  type: "wallet-created" as const,
                  to: user.email,
                  expiresAt: DateTime.addDuration(
                    now,
                    notificationPolicy["wallet.created"].emailTimeToLive,
                  ),
                  variables: {
                    walletName: wallet.metadata.name,
                    ...(wallet.metadata.logo ? { walletLogo: wallet.metadata.logo } : {}),
                    namespace: wallet.namespace,
                    custody: signingKey.custody,
                    actionUrl: dashboardEmailLink(
                      config.dashboardPublicOrigin,
                      `/account/${wallet.id}/overview`,
                    ),
                    organizationName: organization.metadata.name,
                    address: account.address,
                    addressUrl,
                    implementation: account.implementation,
                    ownership,
                    ...(signingKey.data.type === "1claw" ? { provider: "1claw" as const } : {}),
                  },
                },
              })),
          });
          return { wallet, signingKey };
        }),
      )
      .pipe(
        Effect.tapErrorTag("BillingError", () =>
          Metric.update(Metric.withAttributes(creationResults, { result: "limit_exceeded" }), 1),
        ),
        Effect.tapErrorTag("DatabaseError", () =>
          Metric.update(
            Metric.withAttributes(creationResults, { result: "persistence_failed" }),
            1,
          ),
        ),
        Effect.catchTag(
          "DatabaseError",
          () =>
            new WalletCreationError({
              code: "WALLET_PERSISTENCE_FAILED",
              namespace: input.request.namespace,
            }),
        ),
      );

    yield* Metric.update(Metric.withAttributes(creationResults, { result: "success" }), 1);
    yield* Effect.logInfo("wallet.created").pipe(
      Effect.annotateLogs({
        namespace: input.request.namespace,
        implementation: "alchemy-modular-v2",
        custody,
        protection_level: protectionLevel,
      }),
    );
    return result;
  }, Effect.trackDuration(walletCreationDuration));
});
