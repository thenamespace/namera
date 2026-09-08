import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { createTestManagedWallet } from "../../fixtures/managed-wallet.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();

layer(fixture.layer)("delegated wallet read boundaries", (it) => {
  it.effect(
    "scopes wallet and portfolio reads to live grants and rejects revoked credentials",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        yield* signIn(client, testEmail("foreign-wallet-reader@example.com"));
        const foreign = yield* createTestPasskeyWallet(client, "Foreign wallet");

        const owner = yield* signIn(client, testEmail("delegated-wallet-reader@example.com"));
        const granted = yield* createTestPasskeyWallet(client, "Granted wallet");
        // The owner fixture has one credential per organization. Internal managed
        // fixtures give this tenant a second, ungranted wallet without reusing it.
        const ungranted = yield* createTestManagedWallet(client, {
          payload: {
            namespace: "eip155",
            owner: { type: "namera-managed", protectionLevel: "software" },
            metadata: { version: 1, name: "Ungrantable wallet" },
          },
        });
        const pending = yield* client.sessionKey.create({
          payload: yield* localSessionRequest(granted.id),
        });
        const session = yield* fixture.confirmOperation(client, pending, "install");
        const credential = yield* client.apiKey.create({
          payload: {
            metadata: { version: 1, name: "Scoped wallet reader" },
            durationDays: 1,
            sessionKeyIds: [session.id],
          },
        });

        yield* setAuthToken();
        yield* setApiKey(credential.key);
        expect((yield* client.wallet.list()).map(({ id }) => id)).toEqual([granted.id]);
        expect((yield* client.wallet.get({ params: { walletId: granted.id } })).id).toBe(
          granted.id,
        );
        expect(
          yield* client.wallet.getPortfolio({ params: { walletId: granted.id }, query: {} }),
        ).toMatchObject({ items: [], partialFailures: [] });

        for (const wallet of [ungranted, foreign]) {
          const reads: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
            client.wallet.get({ params: { walletId: wallet.id } }),
            client.wallet.getPortfolio({ params: { walletId: wallet.id }, query: {} }),
          ];
          for (const read of reads) {
            expect(yield* read.pipe(Effect.flip)).toMatchObject({
              _tag: "WalletError",
              code: "WALLET_NOT_FOUND",
            });
          }
        }

        // A granted machine credential still cannot read owner ceremony material or edit wallets.
        const userOnly: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
          client.wallet.getPasskeyOwner({ params: { walletId: granted.id } }),
          client.wallet.createPasskeyRegistrationOptions(),
          client.wallet.update({
            params: { walletId: granted.id },
            payload: { metadata: { version: 1, name: "Forbidden edit" } },
          }),
        ];
        for (const request of userOnly) {
          expect(yield* request.pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
        }

        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
        expect((yield* client.wallet.get({ params: { walletId: granted.id } })).metadata.name).toBe(
          "Granted wallet",
        );

        // API authority is removed immediately, without waiting for onchain uninstallation.
        yield* setAuthToken();
        yield* setApiKey(credential.key);
        expect(yield* client.wallet.list()).toEqual([]);
        expect(
          yield* client.wallet.get({ params: { walletId: granted.id } }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
        expect(
          yield* client.wallet
            .getPortfolio({ params: { walletId: granted.id }, query: {} })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });

        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        yield* client.apiKey.revoke({ params: { apiKeyId: credential.apiKey.id } });
        yield* setAuthToken();
        yield* setApiKey(credential.key);
        const revokedReads: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
          client.wallet.list(),
          client.wallet.get({ params: { walletId: granted.id } }),
          client.wallet.getPortfolio({ params: { walletId: granted.id }, query: {} }),
        ];
        for (const read of revokedReads) {
          expect(yield* read.pipe(Effect.flip)).toMatchObject({ _tag: "Unauthorized" });
        }
      }),
  );
});
