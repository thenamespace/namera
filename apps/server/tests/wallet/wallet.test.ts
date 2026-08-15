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
} from "../helpers/index.js";
import { TestEmails, TestServerLayer } from "../layers/index.js";

const metadata = (name: string) => ({ version: 1 as const, name });

layer(TestServerLayer)("wallet routes", (it) => {
  it.effect("creates, lists, and reads Kernel and Safe wallets", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("wallet-owner@example.com"));

      const kernel = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
          metadata: metadata("Treasury"),
        },
      });
      const safe = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "safe",
          protectionLevel: "software",
          metadata: metadata("Operations"),
        },
      });

      expect(kernel).toMatchObject({
        organizationId: owner.actor.organization.id,
        namespace: "eip155",
        implementation: "kernel",
        protectionLevel: "software",
        data: {
          kernelVersion: "0.3.3",
          entryPointVersion: "0.7",
          validatorType: "webauthn_p256",
          accountIndex: 0n,
        },
      });
      expect(safe).toMatchObject({
        namespace: "eip155",
        implementation: "safe",
        data: {
          safeVersion: "1.4.1",
          entryPointVersion: "0.7",
          saltNonce: 0n,
        },
      });
      expect((yield* client.wallet.list()).map((wallet) => wallet.id)).toEqual([
        safe.id,
        kernel.id,
      ]);
      expect((yield* client.wallet.get({ params: { walletId: kernel.id } })).id).toBe(kernel.id);

      const repository = yield* Repository;
      const events = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );
      const walletEvents = events.filter((event) => event.event === "wallet.created");
      const walletKeyEvents = events.filter((event) => event.event === "wallet_key.created");
      expect(walletEvents.map((event) => event.resourceId)).toEqual(
        expect.arrayContaining([kernel.id, safe.id]),
      );
      expect(walletKeyEvents).toHaveLength(2);
      expect(walletEvents.map((event) => event.correlationId).toSorted()).toEqual(
        walletKeyEvents.map((event) => event.correlationId).toSorted(),
      );
      expect(
        (yield* client.notification.list({ query: {} })).items.filter(
          (item) => item.notification.type === "wallet.created",
        ),
      ).toHaveLength(2);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:wallet.created:${kernel.id}:${owner.actor.user.id}:email`,
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
        addressDisplay: "0x222222…222222",
        addressUrl: "https://etherscan.io/address/0x2222222222222222222222222222222222222222",
        implementationName: "Safe",
        protectionLevelName: "Software",
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

      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
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
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
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
              implementation: "safe",
              protectionLevel: "software",
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

      const hsmError = yield* client.wallet
        .create({
          payload: {
            namespace: "eip155",
            implementation: "kernel",
            protectionLevel: "hsm",
            metadata: metadata("HSM"),
          },
        })
        .pipe(Effect.flip);
      expect(hsmError).toMatchObject({ _tag: "BillingError", limit: "hsmWallets" });

      for (let index = 0; index < 5; index += 1) {
        yield* client.wallet.create({
          payload: {
            namespace: "eip155",
            implementation: "kernel",
            protectionLevel: "software",
            metadata: metadata(`Wallet ${index}`),
          },
        });
      }
      const softwareError = yield* client.wallet
        .create({
          payload: {
            namespace: "eip155",
            implementation: "safe",
            protectionLevel: "software",
            metadata: metadata("Over limit"),
          },
        })
        .pipe(Effect.flip);
      expect(softwareError).toMatchObject({
        _tag: "BillingError",
        limit: "softwareWallets",
      });
    }),
  );
});
