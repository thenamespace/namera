import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";

import {
  createMember,
  makeTestApiClient,
  missingWalletId,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestEmails, TestServerLayer } from "../../fixtures/layers/index.js";
import { createTestManagedWallet } from "../../fixtures/managed-wallet.js";

const metadata = (name: string) => ({ version: 1 as const, name });

layer(TestServerLayer)("wallet routes", (it) => {
  it.effect("rejects managed custody in beta without creating resources or billing usage", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("beta-custody@example.com"));
      const repository = yield* Repository;
      const billingBefore = yield* client.billing.get();
      const auditBefore = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );

      for (const managedOwner of [
        { type: "namera-managed", protectionLevel: "software" },
        { type: "namera-managed", protectionLevel: "hsm" },
        { type: "namera-managed", provider: "1claw" },
      ] as const) {
        const error = yield* client.wallet
          .create({
            payload: {
              namespace: "eip155",
              owner: managedOwner,
              metadata: metadata("Unavailable managed account"),
            },
          })
          .pipe(Effect.flip);
        expect(error).toMatchObject({
          _tag: "WalletCustodyUnavailableError",
          code: "MANAGED_WALLETS_DISABLED",
        });
      }

      const internalError = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", provider: "1claw" },
          metadata: metadata("Unavailable internal 1Claw account"),
        },
      }).pipe(Effect.flip);
      expect(internalError).toMatchObject({
        _tag: "WalletCustodyUnavailableError",
        code: "MANAGED_WALLETS_DISABLED",
      });

      expect(yield* client.wallet.list()).toEqual([]);
      expect(yield* client.billing.get()).toEqual(billingBefore);
      expect(
        yield* repository.audit.organization.findForOrganization(owner.actor.organization.id),
      ).toEqual(auditBefore);
    }),
  );

  it.effect("lists and reads existing managed Alchemy Modular V2 wallets", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("wallet-owner@example.com"));

      const treasury = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: metadata("Treasury"),
        },
      });
      const operations = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: { ...metadata("Operations"), logo: { type: "emoji", value: "💳" } },
        },
      });

      expect(treasury).toMatchObject({
        organizationId: owner.actor.organization.id,
        namespace: "eip155",
        implementation: "alchemy-modular-v2",
        owner: {
          custody: "namera-managed",
          protectionLevel: "software",
        },
        data: {
          modularAccountVersion: "2.0.0",
          entryPointVersion: "0.7",
          validatorType: "webauthn_p256",
          salt: 0n,
          entityId: 0,
        },
      });
      expect(operations).toMatchObject({
        namespace: "eip155",
        implementation: "alchemy-modular-v2",
        data: {
          modularAccountVersion: "2.0.0",
          entryPointVersion: "0.7",
          salt: 0n,
          entityId: 0,
        },
      });
      expect((yield* client.wallet.list()).map((wallet) => wallet.id)).toEqual([
        operations.id,
        treasury.id,
      ]);
      expect((yield* client.wallet.get({ params: { walletId: treasury.id } })).id).toBe(
        treasury.id,
      );
      expect(
        yield* client.wallet.getPortfolio({ params: { walletId: treasury.id }, query: {} }),
      ).toMatchObject({
        summary: { assetCount: 0, totalValueUsd: "0" },
        items: [],
        nextCursor: null,
        partialFailures: [],
      });

      const repository = yield* Repository;
      const events = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );
      const walletEvents = events.filter((event) => event.event === "wallet.created");
      const signingKeyEvents = events.filter((event) => event.event === "signing_key.created");
      expect(walletEvents.map((event) => event.resourceId)).toEqual(
        expect.arrayContaining([treasury.id, operations.id]),
      );
      expect(signingKeyEvents).toHaveLength(2);
      expect(walletEvents.map((event) => event.correlationId).toSorted()).toEqual(
        signingKeyEvents.map((event) => event.correlationId).toSorted(),
      );
      expect(
        (yield* client.notification.list({ query: {} })).items.filter(
          (item) => item.notification.type === "wallet.created",
        ),
      ).toHaveLength(2);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:wallet.created:${treasury.id}:${owner.actor.user.id}:email`,
        ),
      ).toMatchObject({ type: "wallet-created", status: "pending" });

      const emailJobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      let delivered = (yield* emails.sent).findLast(
        (email) => email.type === "wallet-created" && email.variables.walletName === "Operations",
      );
      for (let attempt = 0; delivered === undefined && attempt < 10; attempt += 1) {
        yield* emailJobs.processOnce;
        delivered = (yield* emails.sent).findLast(
          (email) => email.type === "wallet-created" && email.variables.walletName === "Operations",
        );
      }
      expect(delivered?.variables).toMatchObject({
        walletName: "Operations",
        walletLogo: { type: "emoji", value: "💳" },
        namespace: "eip155",
        custody: "namera-managed",
        actionUrl: `http://dashboard.test/auth?returnTo=%2Faccount%2F${operations.id}%2Foverview`,
        address: "0x3333333333333333333333333333333333333333",
        addressUrl: "https://etherscan.io/address/0x3333333333333333333333333333333333333333",
        implementation: "alchemy-modular-v2",
        ownership: "Namera managed · Software",
      });
    }),
  );

  it.effect("honors wallet notification email preferences", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("wallet-preference@example.com"));
      yield* client.notification.updatePreference({
        payload: {
          organizationId: null,
          category: "organization",
          topic: "wallets",
          channel: "email",
          enabled: false,
        },
      });

      const wallet = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: metadata("No email"),
        },
      });
      const repository = yield* Repository;
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:wallet.created:${wallet.id}:${owner.actor.user.id}:email`,
        ),
      ).toBeUndefined();
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          (item) => item.notification.resourceId === wallet.id,
        ),
      ).toBe(true);
    }),
  );

  it.effect("enforces active-organization isolation and wallet permissions", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("wallet-permission-owner@example.com"));
      const member = yield* createMember(client, testEmail("wallet-reader@example.com"));
      yield* setAuthToken(member.ownerToken);
      const wallet = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: metadata("Readable"),
        },
      });

      yield* setAuthToken(member.memberToken);
      expect(yield* client.wallet.list()).toHaveLength(1);
      expect((yield* client.wallet.get({ params: { walletId: wallet.id } })).id).toBe(wallet.id);
      expect(
        yield* client.wallet
          .create({
            payload: {
              namespace: "eip155",
              owner: { type: "namera-managed", protectionLevel: "software" },
              metadata: metadata("Forbidden"),
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          (item) => item.notification.resourceId === wallet.id,
        ),
      ).toBe(true);
      const repository = yield* Repository;
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:wallet.created:${wallet.id}:${member.actor.user.id}:email`,
        ),
      ).toMatchObject({ type: "wallet-created" });

      const other = yield* signIn(client, testEmail("wallet-other@example.com"));
      expect(
        yield* client.wallet.get({ params: { walletId: wallet.id } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
      expect(other.actor.organization.id).not.toBe(member.owner.organization.id);
      expect(
        yield* client.wallet.get({ params: { walletId: missingWalletId } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
    }),
  );

  it.effect("enforces software and HSM wallet limits", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("wallet-limit@example.com"));

      const hsmError = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "hsm" },
          metadata: metadata("HSM"),
        },
      }).pipe(Effect.flip);
      expect(hsmError).toMatchObject({ _tag: "BillingError", limit: "hsmWallets" });

      for (let index = 0; index < 5; index += 1) {
        yield* createTestManagedWallet(client, {
          payload: {
            namespace: "eip155",
            owner: { type: "namera-managed", protectionLevel: "software" },
            metadata: metadata(`Wallet ${index}`),
          },
        });
      }
      const softwareError = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: metadata("Over limit"),
        },
      }).pipe(Effect.flip);
      expect(softwareError).toMatchObject({
        _tag: "BillingError",
        limit: "softwareWallets",
      });
    }),
  );

  it.effect("updates only wallet metadata and audits actual changes", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("wallet-update@example.com"));
      const wallet = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: metadata("Original account"),
        },
      });
      const updatedMetadata = {
        version: 1 as const,
        name: "Treasury account",
        description: "Primary organization treasury",
      };

      const updated = yield* client.wallet.update({
        params: { walletId: wallet.id },
        payload: { metadata: updatedMetadata },
      });
      expect(updated).toMatchObject({
        id: wallet.id,
        metadata: updatedMetadata,
        address: wallet.address,
        namespace: wallet.namespace,
        implementation: wallet.implementation,
        owner: wallet.owner,
      });
      yield* client.wallet.update({
        params: { walletId: wallet.id },
        payload: { metadata: updatedMetadata },
      });
      const repository = yield* Repository;
      const events = (yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      )).filter(({ event, resourceId }) => event === "wallet.updated" && resourceId === wallet.id);
      expect(events).toHaveLength(1);
      expect(events[0]?.data).toMatchObject({ version: 1, changedFields: ["metadata"] });
    }),
  );

  it.effect("enforces wallet update permission and organization isolation", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("wallet-update-owner@example.com"));
      const member = yield* createMember(client, testEmail("wallet-update-member@example.com"));
      yield* setAuthToken(member.ownerToken);
      const wallet = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: metadata("Owner account"),
        },
      });

      yield* setAuthToken(member.memberToken);
      expect(
        yield* client.wallet
          .update({
            params: { walletId: wallet.id },
            payload: { metadata: metadata("Forbidden update") },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });

      yield* signIn(client, testEmail("wallet-update-other@example.com"));
      expect(
        yield* client.wallet
          .update({
            params: { walletId: wallet.id },
            payload: { metadata: metadata("Cross organization") },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
      expect(
        yield* client.wallet
          .update({
            params: { walletId: missingWalletId },
            payload: { metadata: metadata("Missing") },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
    }),
  );
});
