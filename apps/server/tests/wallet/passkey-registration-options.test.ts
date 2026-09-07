import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  createMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

const passkeyResponse = (id: string) => ({
  id,
  rawId: id,
  response: {
    clientDataJSON: "dGVzdA",
    attestationObject: "dGVzdA",
    transports: ["internal"],
  },
  authenticatorAttachment: "platform" as const,
  clientExtensionResults: { credProps: { rk: true } },
  type: "public-key" as const,
});

layer(TestServerLayer)("passkey registration options route", (it) => {
  it.effect("creates tenant-bound P-256 registration options and replaces the prior ceremony", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("passkey-options@example.com"));

      const first = yield* client.wallet.createPasskeyRegistrationOptions();
      expect(first.options).toMatchObject({
        rp: { id: "dashboard.test", name: "Namera" },
        user: {
          name: owner.actor.user.email,
          displayName: owner.actor.user.email,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        timeout: 300_000,
        attestation: "none",
        authenticatorSelection: {
          residentKey: "required",
          requireResidentKey: true,
          userVerification: "required",
        },
        extensions: { credProps: true },
      });
      expect(first.options.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(first.options.user.id).toMatch(/^[A-Za-z0-9_-]+$/);

      const repository = yield* Repository;
      const pending = yield* repository.auth.verification.findPendingByIdentifier({
        purpose: "passkey-registration",
        identifier: `${owner.actor.organization.id}:${owner.actor.user.id}`,
        now: yield* DateTime.now,
        maxAttempts: 1,
      });
      expect(pending).toMatchObject({
        id: first.verificationId,
        purpose: "passkey-registration",
        tokenHash: null,
        codeHmac: null,
        data: {
          version: 1,
          challenge: first.options.challenge,
          rpId: "dashboard.test",
          origin: "http://dashboard.test",
          organizationId: owner.actor.organization.id,
          userId: owner.actor.user.id,
        },
      });

      const second = yield* client.wallet.createPasskeyRegistrationOptions();
      expect(second.verificationId).not.toBe(first.verificationId);
      expect(second.options.challenge).not.toBe(first.options.challenge);
      const replaced = yield* repository.auth.verification.findById(first.verificationId);
      expect(replaced?.revokedAt).not.toBeNull();
    }),
  );

  it.effect("requires an authenticated user with wallet creation permission", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      expect(
        yield* client.wallet.createPasskeyRegistrationOptions().pipe(Effect.flip),
      ).toMatchObject({ _tag: "Unauthorized" });

      yield* signIn(client, testEmail("passkey-permission-owner@example.com"));
      const member = yield* createMember(client, testEmail("passkey-member@example.com"));
      yield* setAuthToken(member.memberToken);
      expect(
        yield* client.wallet.createPasskeyRegistrationOptions().pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
    }),
  );

  it.effect("creates a user-owned wallet from a one-time passkey ceremony", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("passkey-wallet@example.com"));

      const registration = yield* client.wallet.createPasskeyRegistrationOptions();
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          owner: {
            type: "passkey",
            verificationId: registration.verificationId,
            response: passkeyResponse("test-passkey"),
          },
          metadata: { version: 1, name: "Personal passkey" },
        },
      });

      expect(wallet.owner).toMatchObject({ custody: "local", algorithm: "p256" });
      const repository = yield* Repository;
      expect(
        yield* repository.core.signingKey.findById(
          wallet.owner.signingKeyId,
          wallet.organizationId,
        ),
      ).toMatchObject({
        purpose: "wallet-root",
        custody: "local",
        algorithm: "p256",
        data: {
          type: "passkey",
          credentialId: "test-passkey",
          rpId: "dashboard.test",
        },
      });
      expect(
        (yield* repository.auth.verification.findById(registration.verificationId))?.consumedAt,
      ).not.toBeNull();

      expect(
        yield* client.wallet
          .create({
            payload: {
              namespace: "eip155",
              owner: {
                type: "passkey",
                verificationId: registration.verificationId,
                response: passkeyResponse("test-passkey"),
              },
              metadata: { version: 1, name: "Reused ceremony" },
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "PasskeyVerificationError", code: "REGISTRATION_NOT_FOUND" });
    }),
  );

  it.effect("rejects an invalid passkey registration response", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("invalid-passkey-wallet@example.com"));
      const registration = yield* client.wallet.createPasskeyRegistrationOptions();

      expect(
        yield* client.wallet
          .create({
            payload: {
              namespace: "eip155",
              owner: {
                type: "passkey",
                verificationId: registration.verificationId,
                response: passkeyResponse("invalid-passkey"),
              },
              metadata: { version: 1, name: "Invalid passkey" },
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "PasskeyVerificationError", code: "REGISTRATION_INVALID" });
    }),
  );
});
