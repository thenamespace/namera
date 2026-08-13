import { DateTime, Effect, Metric, Schema } from "effect";

import { Repository, TransactionService, type WalletView } from "@namera-ai/database";
import { Evm, createWalletKeyWebAuthnAccount } from "@namera-ai/evm";
import {
  WalletCreationError,
  WalletKeyId,
  WalletNotFoundError,
  type ActorId,
  type BillingError,
  type OrganizationId,
  type WalletId,
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

export interface WalletApplication {
  readonly create: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateWalletRequest;
  }) => Effect.Effect<WalletView, BillingError | WalletCreationError>;
  readonly list: (organizationId: OrganizationId) => Effect.Effect<ReadonlyArray<WalletView>>;
  readonly get: (
    organizationId: OrganizationId,
    walletId: WalletId,
  ) => Effect.Effect<WalletView, WalletNotFoundError>;
}

export const makeWalletApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const authConfig = yield* AuthConfig;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const walletKeys = yield* WalletKeys;
  const createNotification = yield* makeCreateNotification;

  const create = Effect.fn("Application.wallet.create")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateWalletRequest;
  }) {
    const creationResults = Metric.withAttributes(walletCreationResults, {
      namespace: input.request.namespace,
      implementation: input.request.implementation,
      protectionLevel: input.request.protectionLevel,
    });

    yield* enforceWalletLimit(repository, input.organizationId, input.request.protectionLevel).pipe(
      Effect.tapErrorTag("BillingError", () => Metric.update(creationResults, "limit_exceeded")),
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const walletKeyId = Schema.decodeSync(WalletKeyId)(generateUniqueId());
    const createdKey = yield* walletKeys
      .create({
        id: walletKeyId,
        algorithm: walletPolicy.eip155.algorithm,
        protectionLevel: input.request.protectionLevel,
      })
      .pipe(
        Effect.tapError(() => Metric.update(creationResults, "key_failed")),
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
      sign: (payload) =>
        Effect.runPromise(
          walletKeys.sign({
            keyVersionName: createdKey.keyVersionName,
            algorithm: createdKey.algorithm,
            payload,
          }),
        ),
    });

    const account =
      input.request.implementation === "kernel"
        ? yield* evm
            .createAccount({
              implementation: "kernel",
              chainId: walletPolicy.eip155.derivationChainId,
              entryPointVersion: walletPolicy.eip155.kernel.entryPointVersion,
              kernelVersion: walletPolicy.eip155.kernel.kernelVersion,
              accountIndex: walletPolicy.eip155.kernel.accountIndex,
              owner,
            })
            .pipe(
              Effect.tapError(() => Metric.update(creationResults, "account_failed")),
              Effect.mapError(
                () =>
                  new WalletCreationError({
                    code: "ACCOUNT_CREATION_FAILED",
                    namespace: input.request.namespace,
                  }),
              ),
            )
        : yield* evm
            .createAccount({
              implementation: "safe",
              chainId: walletPolicy.eip155.derivationChainId,
              entryPointVersion: walletPolicy.eip155.safe.entryPointVersion,
              safeVersion: walletPolicy.eip155.safe.safeVersion,
              saltNonce: walletPolicy.eip155.safe.saltNonce,
              owner,
            })
            .pipe(
              Effect.tapError(() => Metric.update(creationResults, "account_failed")),
              Effect.mapError(
                () =>
                  new WalletCreationError({
                    code: "ACCOUNT_CREATION_FAILED",
                    namespace: input.request.namespace,
                  }),
              ),
            );

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
            keyVersionName: createdKey.keyVersionName,
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
          const accountEvent =
            account.implementation === "kernel"
              ? {
                  implementation: account.implementation,
                  implementationVersion: account.kernelVersion,
                  entryPointVersion: account.entryPointVersion,
                }
              : {
                  implementation: account.implementation,
                  implementationVersion: account.safeVersion,
                  entryPointVersion: account.entryPointVersion,
                };
          const walletKeyEvent = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "wallet_key.created",
            resourceType: "wallet-key",
            resourceId: walletKey.id,
            data: {
              version: 1,
              protectionLevel: walletKey.protectionLevel,
            },
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
        Effect.tapErrorTag("BillingError", () => Metric.update(creationResults, "limit_exceeded")),
        Effect.tapErrorTag("DatabaseError", () =>
          Metric.update(creationResults, "persistence_failed"),
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

    yield* Metric.update(creationResults, "success");
    yield* Effect.logInfo("wallet.created", {
      namespace: input.request.namespace,
      implementation: input.request.implementation,
      protectionLevel: input.request.protectionLevel,
    });
    return result;
  }, Effect.trackDuration(walletCreationDuration));

  const list = Effect.fn("Application.wallet.list")(
    function* (organizationId: OrganizationId) {
      return yield* repository.core.wallet.findForOrganization(organizationId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("Application.wallet.get")(
    function* (organizationId: OrganizationId, walletId: WalletId) {
      const wallet = yield* repository.core.wallet.findById(walletId, organizationId);
      if (wallet === undefined) {
        return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
      }
      return wallet;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { create, list, get } satisfies WalletApplication;
});
