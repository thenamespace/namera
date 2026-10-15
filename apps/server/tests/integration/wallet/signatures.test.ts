import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database, Repository } from "@namera-ai/database";
import { makeTestEvmOwnerSignatureService } from "@namera-ai/evm";
import { EvmTypedData } from "@namera-ai/protocol";
import type {
  PrepareWalletSignatureRequest,
  PrepareWalletSignatureResponse,
} from "@namera-ai/protocol/dto";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  createMember,
  makeTestApiClient,
  setAuthToken,
  setApiKey,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";
import { setupPasskeyWalletOwner } from "../../fixtures/passkey-wallet-owner.js";

const fixture = makeOwnerSessionTestFixture(
  {},
  { ownerSignatures: makeTestEvmOwnerSignatureService() },
);
const message = {
  namespace: "eip155",
  chainId: "eip155:8453",
  type: "message",
  message: "Sign in to the test app",
} as const;
const typed: PrepareWalletSignatureRequest = {
  namespace: "eip155",
  chainId: "eip155:8453",
  type: "typed-data",
  typedData: EvmTypedData.make({
    domain: { name: "Test app", chainId: 8453 },
    types: { Login: [{ name: "nonce", type: "string" }] },
    primaryType: "Login",
    message: { nonce: "test-nonce" },
  }),
};
const setup = setupPasskeyWalletOwner("signatures");
const approval = (prepared: PrepareWalletSignatureResponse, origin = "http://dashboard.test") => {
  if (prepared.signing.method !== "passkey") throw new Error("Expected passkey");
  return {
    namespace: "eip155" as const,
    operationId: prepared.operationId,
    response: fixture.authenticator.authenticate({
      challenge: prepared.signing.options.challenge,
      origin,
      rpId: "dashboard.test",
      counter: 0,
    }),
  };
};

layer(fixture.layer)("owner wallet signatures", (it) => {
  for (const request of [message, typed]) {
    it.effect(`prepares and completes ${request.type}, replaying the encrypted result once`, () =>
      Effect.gen(function* () {
        const { client, params, wallet } = yield* setup;
        const input =
          request.type === "message"
            ? { params, headers: { "idempotency-key": "sign" }, payload: request }
            : { params, headers: { "idempotency-key": "sign" }, payload: request };
        const prepared = yield* client.walletSignature.prepare(input);
        expect(prepared.request).toEqual(request);
        expect(prepared.signingKeyId).toBe(wallet.owner.signingKeyId);
        expect((yield* client.walletSignature.prepare(input)).operationId).toBe(
          prepared.operationId,
        );
        const complete = { params, payload: approval(prepared) };
        const result = yield* client.walletSignature.complete(complete);
        expect(result).toMatchObject({
          namespace: "eip155",
          type: request.type,
          walletId: wallet.id,
          operationId: prepared.operationId,
          chainId: request.chainId,
        });
        expect(result.signature.length).toBeGreaterThan(132);
        yield* TestClock.adjust(Duration.minutes(6));
        expect(yield* client.walletSignature.complete(complete)).toEqual(result);
        const db = yield* Database;
        const rows = yield* db.query.walletSignatureOperation.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe("succeeded");
        expect(rows[0]?.encryptedResult).not.toContain(result.signature);
        expect(rows[0]?.leaseToken).toBeNull();
        const events = yield* db.query.organizationEvent.findMany();
        expect(events.filter((e) => e.event === "wallet.signature_created")).toHaveLength(1);
      }),
    );
  }
  it.effect("rejects API keys and OAuth even with signing scopes and an active wallet grant", () =>
    Effect.gen(function* () {
      const { client, wallet, params, author } = yield* setup;
      const session = yield* client.sessionKey.create({
        payload: yield* localSessionRequest(wallet.id),
      });
      yield* fixture.confirmOperation(client, session, "install");
      const key = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Agent" },
          durationDays: 7,
          sessionKeyIds: [session.id],
        },
      });
      const prepared = yield* client.walletSignature.prepare({
        params,
        headers: { "idempotency-key": "machine" },
        payload: message,
      });
      const app = yield* Application;
      const started = yield* app.oauth.device.start({
        clientId: "namera-cli",
        resource: "http://api.test",
        scopes: ["wallet:read", "signature:create"],
        deviceName: "Owner signing test",
        cliVersion: "0.1.0",
        platform: "test",
      });
      const claim = yield* client.oauth.getOAuthDeviceAuthorization({
        query: { userCode: started.userCode },
      });
      yield* client.oauth.approveOAuthDeviceAuthorization({
        payload: {
          deviceAuthorizationId: claim.id,
          organizationId: author.actor.organization.id,
          sessionKeyIds: [session.id],
        },
      });
      const token = yield* app.oauth.device.exchange({
        clientId: "namera-cli",
        resource: "http://api.test",
        deviceCode: started.deviceCode,
      });
      yield* setAuthToken();
      const cli = yield* handledApi(NameraApi, {
        headers: { authorization: `Bearer ${token.accessToken}`, origin: "http://dashboard.test" },
      });
      expect((yield* cli.wallet.get({ params })).id).toBe(wallet.id);
      expect(
        yield* cli.walletSignature
          .prepare({ params, headers: { "idempotency-key": "oauth-blocked" }, payload: message })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      expect(
        yield* cli.walletSignature
          .complete({ params, payload: { namespace: "eip155", operationId: prepared.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      yield* setAuthToken();
      yield* setApiKey(key.key);
      const machine = yield* makeTestApiClient;
      expect((yield* machine.wallet.get({ params })).id).toBe(wallet.id);
      expect(
        yield* machine.walletSignature
          .prepare({ params, headers: { "idempotency-key": "blocked" }, payload: message })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      expect(
        yield* machine.walletSignature
          .complete({ params, payload: { namespace: "eip155", operationId: prepared.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
    }),
  );
  it.effect("allows only one live completion lease and recovers an abandoned lease", () =>
    Effect.gen(function* () {
      const { client, params, author } = yield* setup;
      const prepared = yield* client.walletSignature.prepare({
        params,
        headers: { "idempotency-key": "lease" },
        payload: message,
      });
      const repository = (yield* Repository).core.walletSignatureOperation;
      const now = yield* DateTime.now;
      const scope = {
        organizationId: author.actor.organization.id,
        actorId: author.actor.actorId,
        id: prepared.operationId,
      };
      expect(
        yield* repository.claim({
          ...scope,
          leaseToken: "first",
          now,
          leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
        }),
      ).toBeDefined();
      const input = { params, payload: approval(prepared) };
      expect(yield* client.walletSignature.complete(input).pipe(Effect.flip)).toMatchObject({
        code: "OPERATION_BUSY",
      });
      yield* TestClock.adjust(Duration.minutes(2));
      yield* client.walletSignature.complete(input);
      expect(
        yield* repository.succeed({
          ...scope,
          leaseToken: "first",
          now: yield* DateTime.now,
          encryptedResult: "stale",
        }),
      ).toBeUndefined();
      expect((yield* repository.findById(scope))?.status).toBe("succeeded");
    }),
  );
  it.effect(
    "rejects changed idempotency payload and wrong-message assertions without consuming approval",
    () =>
      Effect.gen(function* () {
        const { client, params } = yield* setup;
        const input = { params, headers: { "idempotency-key": "bound" }, payload: message };
        const first = yield* client.walletSignature.prepare(input);
        expect(
          yield* client.walletSignature
            .prepare({ ...input, payload: { ...message, message: "different" } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
        const second = yield* client.walletSignature.prepare({
          ...input,
          headers: { "idempotency-key": "other" },
          payload: { ...message, message: "different" },
        });
        expect(
          yield* client.walletSignature
            .complete({ params, payload: { ...approval(first), operationId: second.operationId } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "APPROVAL_INVALID" });
        expect(
          yield* client.walletSignature
            .complete({ params, payload: approval(second, "https://evil.test") })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "APPROVAL_INVALID" });
        yield* client.walletSignature.complete({ params, payload: approval(second) });
      }),
  );
  it.effect("rejects absent approval, expired preparation and changed owner availability", () =>
    Effect.gen(function* () {
      const { client, params, wallet, author } = yield* setup;
      const prepared = yield* client.walletSignature.prepare({
        params,
        headers: { "idempotency-key": "expiry" },
        payload: message,
      });
      expect(
        yield* client.walletSignature
          .complete({ params, payload: { namespace: "eip155", operationId: prepared.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_INVALID" });
      const complete = { params, payload: approval(prepared) };
      yield* TestClock.adjust(Duration.minutes(6));
      expect(yield* client.walletSignature.complete(complete).pipe(Effect.flip)).toMatchObject({
        code: "APPROVAL_EXPIRED",
      });
      yield* (yield* Repository).core.signingKey.setStatus(
        wallet.owner.signingKeyId,
        author.actor.organization.id,
        "disabled",
      );
      expect(yield* client.walletSignature.complete(complete).pipe(Effect.flip)).toMatchObject({
        code: "OWNER_UNAVAILABLE",
      });
    }),
  );
  it.effect(
    "rejects admin/member sessions, foreign tenants and wrong origins on both endpoints",
    () =>
      Effect.gen(function* () {
        const { client, params, author } = yield* setup;
        const input = { params, headers: { "idempotency-key": "auth" }, payload: message };
        const prepared = yield* client.walletSignature.prepare(input);
        const complete = { params, payload: approval(prepared) };
        for (const role of ["admin", "member"] as const) {
          yield* setAuthToken(author.cookie.value);
          const member = yield* createMember(
            yield* makeTestApiClient,
            testEmail(`sign-${role}@example.com`),
            role,
          );
          const other = yield* handledApi(NameraApi, {
            headers: {
              cookie: `auth-token=${member.memberToken}`,
              origin: "http://dashboard.test",
            },
          });
          expect(yield* other.walletSignature.prepare(input).pipe(Effect.flip)).toMatchObject({
            _tag: "Forbidden",
          });
          expect(yield* other.walletSignature.complete(complete).pipe(Effect.flip)).toMatchObject({
            _tag: "Forbidden",
          });
        }
        const wrong = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${author.cookie.value}`, origin: "https://evil.test" },
        });
        expect(yield* wrong.walletSignature.prepare(input).pipe(Effect.flip)).toMatchObject({
          _tag: "Forbidden",
        });
        expect(yield* wrong.walletSignature.complete(complete).pipe(Effect.flip)).toMatchObject({
          _tag: "Forbidden",
        });
        const stranger = yield* signIn(
          yield* makeTestApiClient,
          testEmail("foreign-signature@example.com"),
        );
        const foreign = yield* handledApi(NameraApi, {
          headers: {
            cookie: `auth-token=${stranger.cookie.value}`,
            origin: "http://dashboard.test",
          },
        });
        expect(yield* foreign.walletSignature.prepare(input).pipe(Effect.flip)).toMatchObject({
          code: "OWNER_UNAVAILABLE",
        });
        expect(yield* foreign.walletSignature.complete(complete).pipe(Effect.flip)).toMatchObject({
          code: "OPERATION_UNAVAILABLE",
        });
      }),
  );
});
