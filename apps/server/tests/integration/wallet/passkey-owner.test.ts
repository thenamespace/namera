import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  makeTestApiClient,
  missingWalletId,
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

layer(fixture.layer)("wallet passkey owner read", (it) => {
  it.effect("returns only public approval data without changing ordinary wallet responses", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("owner-descriptor@example.com"));
      const wallet = yield* createTestPasskeyWallet(client);
      const repository = yield* Repository;
      const key = yield* repository.core.signingKey.findById(
        wallet.owner.signingKeyId,
        wallet.organizationId,
      );
      const [result, response] = yield* client.wallet.getPasskeyOwner({
        params: { walletId: wallet.id },
        responseMode: "decoded-and-response",
      });
      expect(result).toEqual({
        walletId: wallet.id,
        owner: {
          signingKeyId: wallet.owner.signingKeyId,
          publicKeyHex: key?.publicKeyHex,
          credentialId: key?.data.type === "passkey" ? key.data.credentialId : undefined,
          rpId: "dashboard.test",
        },
      });
      expect(response.headers["cache-control"]).toBe("no-store");
      expect((yield* client.wallet.get({ params: { walletId: wallet.id } })).owner).toEqual({
        signingKeyId: wallet.owner.signingKeyId,
        custody: "local",
        algorithm: "p256",
      });

      const managed = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: { version: 1, name: "Managed" },
        },
      });
      expect(yield* client.wallet.getPasskeyOwner({ params: { walletId: managed.id } })).toEqual({
        walletId: managed.id,
        owner: null,
      });
    }),
  );

  it.effect("requires authentication and conceals foreign or missing wallets", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      expect(
        yield* client.wallet
          .getPasskeyOwner({ params: { walletId: missingWalletId } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Unauthorized" });
      yield* signIn(client, testEmail("descriptor-first@example.com"));
      const wallet = yield* createTestPasskeyWallet(client);
      yield* signIn(client, testEmail("descriptor-other@example.com"));
      for (const walletId of [wallet.id, missingWalletId]) {
        expect(
          yield* client.wallet.getPasskeyOwner({ params: { walletId } }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
      }
    }),
  );

  it.effect("denies machine actors even when their grant permits reading the wallet", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("descriptor-agent@example.com"));
      const wallet = yield* createTestPasskeyWallet(client);
      const session = yield* client.sessionKey.create({
        payload: yield* localSessionRequest(wallet.id),
      });
      yield* fixture.confirmOperation(client, session, "install");
      const credential = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Agent" },
          durationDays: 7,
          sessionKeyIds: [session.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(credential.key);
      expect((yield* client.wallet.get({ params: { walletId: wallet.id } })).id).toBe(wallet.id);
      expect(
        yield* client.wallet.getPasskeyOwner({ params: { walletId: wallet.id } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
    }),
  );
});
