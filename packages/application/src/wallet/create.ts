import { DateTime, Effect, Metric, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm, createWalletKeyWebAuthnAccount, getChainDataByChainId } from "@namera-ai/evm";
import {
  WalletCreationError,
  WalletKeyId,
  type ActorId,
  type OrganizationId,
} from "@namera-ai/protocol";
import type { CreateWalletRequest } from "@namera-ai/protocol/dto";
import { walletCreationDuration, walletCreationResults } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";
import { WalletKeys } from "@namera-ai/wallet-keys";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { enforceWalletLimit, lockOrganizationBilling } from "#/billing/index";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

import { walletPolicy } from "./data.js";

export const makeCreateWallet = Effect.gen(function* () {
  const audit = yield* Audit;
  const authConfig = yield* AuthConfig;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const walletKeys = yield* WalletKeys;
  const createNotification = yield* makeCreateNotification;

  return Effect.fn("application.wallet.create")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateWalletRequest;
  }) {
    const creationResults = Metric.withAttributes(walletCreationResults, {
      namespace: input.request.namespace,
      implementation: "alchemy-modular-v2",
      protection_level: input.request.protectionLevel,
    });

    // Avoid a provider call for an exhausted plan. The locked check in the
    // persistence transaction remains authoritative under concurrency.
    yield* enforceWalletLimit(repository, input.organizationId, input.request.protectionLevel).pipe(
      Effect.tapErrorTag("BillingError", () =>
        Metric.update(Metric.withAttributes(creationResults, { result: "limit_exceeded" }), 1),
      ),
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const walletKeyId = Schema.decodeSync(WalletKeyId)(generateUniqueId());
    // Provider key creation cannot join the PostgreSQL transaction, so billing
    // is checked again under a database lock before the resource is persisted.
    const createdKey = yield* walletKeys
      .create({
        id: walletKeyId,
        algorithm: walletPolicy.eip155.algorithm,
        protectionLevel: input.request.protectionLevel,
      })
      .pipe(
        Effect.tapError(() =>
          Metric.update(Metric.withAttributes(creationResults, { result: "key_failed" }), 1),
        ),
        Effect.mapError(
          () =>
            new WalletCreationError({
              code: "KEY_CREATION_FAILED",
              namespace: input.request.namespace,
            }),
        ),
      );

    const owner = createWalletKeyWebAuthnAccount({
      id: walletKeyId,
      publicKey: createdKey.publicKeyHex,
      origin: authConfig.dashboardPublicOrigin.origin,
      rpId: authConfig.dashboardPublicOrigin.hostname,
      validatorType: "webauthn_p256",
      sign: (payload) =>
        Effect.runPromise(walletKeys.signMessage({ ...createdKey, message: payload })),
    });
    const account = yield* evm
      .createAccount({
        chainId: walletPolicy.eip155.derivationChainId,
        entryPointVersion: walletPolicy.eip155.alchemyModularV2.entryPointVersion,
        salt: walletPolicy.eip155.alchemyModularV2.salt,
        entityId: walletPolicy.eip155.alchemyModularV2.entityId,
        owner,
      })
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

    const result = yield* transaction
      .run(
        Effect.gen(function* () {
          yield* lockOrganizationBilling(repository, input.organizationId);
          yield* enforceWalletLimit(
            repository,
            input.organizationId,
            input.request.protectionLevel,
          );
          const walletKey = yield* repository.core.walletKey.insert({
            id: walletKeyId,
            organizationId: input.organizationId,
            provider: createdKey.provider,
            algorithm: createdKey.algorithm,
            protectionLevel: createdKey.protectionLevel,
            publicKeyHex: createdKey.publicKeyHex,
            status: "active",
            data: createdKey.data,
          });
          const wallet = yield* repository.core.wallet.insert({
            organizationId: input.organizationId,
            walletKeyId,
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
          const walletKeyEvent = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "wallet_key.created",
            resourceType: "wallet-key",
            resourceId: walletKey.id,
            data: { version: 1, protectionLevel: walletKey.protectionLevel },
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
                walletKeyId: walletKey.id,
                namespace: wallet.namespace,
                address: account.address,
                protectionLevel: walletKey.protectionLevel,
                account: accountEvent,
              },
            },
            { correlationId: walletKeyEvent.correlationId },
          );

          const organization = yield* repository.auth.organization.findById(input.organizationId);
          if (organization === undefined) {
            return yield* Effect.die("Wallet organization disappeared during creation");
          }
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.organizationId,
          );
          const now = yield* DateTime.now;
          yield* createNotification({
            organizationId: input.organizationId,
            actorId: input.actorId,
            type: "wallet.created",
            resourceType: "wallet",
            resourceId: wallet.id,
            data: {
              version: 1,
              address: account.address,
              implementation: account.implementation,
              protectionLevel: walletKey.protectionLevel,
            },
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
                    organizationName: organization.metadata.name,
                    address: account.address,
                    addressUrl,
                    implementation: account.implementation,
                    protectionLevel: walletKey.protectionLevel,
                  },
                },
              })),
          });
          return { wallet, walletKey };
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
        protection_level: input.request.protectionLevel,
      }),
    );
    return result;
  }, Effect.trackDuration(walletCreationDuration));
});
