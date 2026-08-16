import { DateTime, Effect, Equal, Metric, Schema } from "effect";

import { Repository, TransactionService, type WalletView } from "@namera-ai/database";
import { Evm, createWalletKeyWebAuthnAccount, getChainDataByChainId } from "@namera-ai/evm";
import {
  WalletCreationError,
  WalletKeyId,
  WalletNotFoundError,
  type ActorId,
  type BillingError,
  type OrganizationId,
  type WalletId,
} from "@namera-ai/protocol";
import type { CreateWalletRequest, UpdateWalletRequest } from "@namera-ai/protocol/dto";
import {
  walletCreationDuration,
  walletCreationResults,
  walletMetadataUpdates,
} from "@namera-ai/telemetry";
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
  readonly list: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
  }) => Effect.Effect<ReadonlyArray<WalletView>>;
  readonly get: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly walletId: WalletId;
  }) => Effect.Effect<WalletView, WalletNotFoundError>;
  readonly update: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly walletId: WalletId;
    readonly request: UpdateWalletRequest;
  }) => Effect.Effect<WalletView, WalletNotFoundError>;
}

export const makeWalletApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const authConfig = yield* AuthConfig;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const walletKeys = yield* WalletKeys;
  const createNotification = yield* makeCreateNotification;

  const create = Effect.fn("application.wallet.create")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateWalletRequest;
  }) {
    const creationResults = Metric.withAttributes(walletCreationResults, {
      namespace: input.request.namespace,
      implementation: input.request.implementation,
      protection_level: input.request.protectionLevel,
    });

    // This check avoids a provider call for an already exhausted plan. The
    // locked check in the persistence transaction remains authoritative.
    yield* enforceWalletLimit(repository, input.organizationId, input.request.protectionLevel).pipe(
      Effect.tapErrorTag("BillingError", () =>
        Metric.update(Metric.withAttributes(creationResults, { result: "limit_exceeded" }), 1),
      ),
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const walletKeyId = Schema.decodeSync(WalletKeyId)(generateUniqueId());
    // Remote key creation cannot participate in PostgreSQL transactions. Create
    // it first, then repeat the locked billing check while persisting the wallet
    // so concurrent requests cannot exceed the organization's entitlement.
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
        Effect.runPromise(
          walletKeys.signMessage({
            ...createdKey,
            message: payload,
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
              Effect.tapError(() =>
                Metric.update(
                  Metric.withAttributes(creationResults, { result: "account_failed" }),
                  1,
                ),
              ),
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
              Effect.tapError(() =>
                Metric.update(
                  Metric.withAttributes(creationResults, { result: "account_failed" }),
                  1,
                ),
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
        implementation: input.request.implementation,
        protection_level: input.request.protectionLevel,
      }),
    );
    return result;
  }, Effect.trackDuration(walletCreationDuration));

  const list = Effect.fn("application.wallet.list")(
    function* (input: { readonly organizationId: OrganizationId; readonly actorId?: ActorId }) {
      return yield* input.actorId === undefined
        ? repository.core.wallet.findForOrganization(input.organizationId)
        : repository.core.wallet.findForActor(input.organizationId, input.actorId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("application.wallet.get")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId?: ActorId;
      readonly walletId: WalletId;
    }) {
      const wallet = yield* input.actorId === undefined
        ? repository.core.wallet.findById(input.walletId, input.organizationId)
        : repository.core.wallet.findByIdForActor(
            input.walletId,
            input.organizationId,
            input.actorId,
          );
      if (wallet === undefined) {
        return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
      }
      return wallet;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const update = Effect.fn("application.wallet.update")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly walletId: WalletId;
      readonly request: UpdateWalletRequest;
    }) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const current = yield* repository.core.wallet.findById(
            input.walletId,
            input.organizationId,
          );
          if (current === undefined) {
            return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
          }
          if (Equal.equals(current.wallet.metadata, input.request.metadata)) {
            return { wallet: current, changed: false } as const;
          }
          const wallet = yield* repository.core.wallet.updateMetadata(
            input.walletId,
            input.organizationId,
            input.request.metadata,
          );
          if (wallet === undefined) {
            return yield* new WalletNotFoundError({ code: "WALLET_NOT_FOUND" });
          }
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "wallet.updated",
            resourceType: "wallet",
            resourceId: wallet.wallet.id,
            data: { version: 1, changedFields: ["metadata"] },
          });
          return { wallet, changed: true } as const;
        }),
      );
      if (result.changed) {
        yield* Metric.update(walletMetadataUpdates, 1);
        yield* Effect.logInfo("wallet.updated");
      }
      return result.wallet;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { create, list, get, update } satisfies WalletApplication;
});
