import { expect, layer } from "@effect/vitest";
import { DateTime, Deferred, Effect, Exit, Fiber } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  createMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();
const resource = "http://api.test";
const redirectUri = "http://127.0.0.1:49152/callback";
const verifier = "a".repeat(64);

const assertTokensRevoked = Effect.fnUntraced(function* (token: {
  accessToken: string;
  refreshToken?: string;
}) {
  const cryptography = yield* CryptoService;
  const repository = yield* Repository;
  for (const [purpose, value] of [
    [cryptoPurpose.oauthAccessToken, token.accessToken],
    [cryptoPurpose.oauthRefreshToken, token.refreshToken],
  ] as const) {
    if (!value) return yield* Effect.die("Expected token");
    const row = yield* repository.auth.oauth.token.findByHash(
      yield* cryptography.hash({ purpose, value }),
    );
    expect(row).toBeDefined();
    expect(row?.revokedAt).not.toBeNull();
  }
});

const setup = Effect.fnUntraced(function* (type: "cli" | "mcp") {
  yield* resetTestState();
  const api = yield* makeTestApiClient;
  yield* signIn(api, testEmail(`offboard-owner-${crypto.randomUUID()}@example.com`));
  const wallet = yield* createTestPasskeyWallet(api, "Offboarding wallet");
  const pending = yield* api.sessionKey.create({ payload: yield* localSessionRequest(wallet.id) });
  const session = yield* fixture.confirmOperation(api, pending, "install");
  const admin = yield* createMember(
    api,
    testEmail(`offboard-admin-${crypto.randomUUID()}@example.com`),
    "admin",
  );
  const shared = yield* api.apiKey.create({
    payload: {
      metadata: { version: 1, name: "Shared automation" },
      durationDays: 30,
      sessionKeyIds: [session.id],
    },
  });
  const app = yield* Application;
  const repository = yield* Repository;
  const clientId = type === "cli" ? "namera-cli" : "offboarding-mcp";
  const common = {
    organizationId: admin.owner.organization.id,
    actorId: admin.actor.actorId,
    userId: admin.actor.user.id,
    sessionKeyIds: [session.id],
  };
  const consent = yield* Effect.gen(function* () {
    if (type === "cli") {
      const started = yield* app.oauth.device.start({
        clientId,
        resource,
        scopes: ["wallet:read", "execution:execute", "offline_access"],
        deviceName: "Offboarding",
        cliVersion: "0.1.0",
        platform: "test",
      });
      const claim = yield* api.oauth.getOAuthDeviceAuthorization({
        query: { userCode: started.userCode },
      });
      return {
        approve: app.oauth.device
          .approve({ ...common, deviceAuthorizationId: claim.id })
          .pipe(Effect.asVoid),
        exchange: app.oauth.device.exchange({ clientId, resource, deviceCode: started.deviceCode }),
      };
    }
    yield* repository.auth.oauth.client.insertPreRegistered({
      clientId,
      clientName: "Offboarding MCP",
      clientUri: null,
      logoUri: null,
      redirectUris: [redirectUri],
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      tokenEndpointAuthMethod: "none",
      metadata: {},
      status: "active",
      metadataExpiresAt: null,
    });
    const cryptography = yield* CryptoService;
    const started = yield* app.oauth.request.start({
      clientId,
      redirectUri,
      responseType: "code",
      codeChallenge: yield* cryptography.sha256(verifier),
      codeChallengeMethod: "S256",
      resource,
      scopes: ["mcp:read", "mcp:execute", "offline_access"],
      state: "test",
    });
    let code: string | null = null;
    return {
      approve: app.oauth.authorization
        .approve({ ...common, requestId: started.request.id, expiresAt: null })
        .pipe(
          Effect.tap((approved) =>
            Effect.sync(() => {
              code = new URL(approved.redirectUrl).searchParams.get("code");
            }),
          ),
          Effect.asVoid,
        ),
      exchange: Effect.suspend(() =>
        code === null
          ? Effect.die("Missing authorization code")
          : app.oauth.token.exchangeAuthorizationCode({
              code,
              clientId,
              redirectUri,
              codeVerifier: verifier,
              resource,
            }),
      ),
    };
  });
  yield* setAuthToken();
  const owner = yield* handledApi(NameraApi, {
    headers: { cookie: `auth-token=${admin.ownerToken}`, origin: "http://dashboard.test" },
  });
  const remove = owner.member.removeMember({
    payload: { organizationMemberId: admin.actor.member.organizationMember.id },
  });
  return { ...consent, remove, admin, shared, session, wallet, clientId, owner };
});

// Hold the first workflow's transaction open while the second starts. This
// exercises uncommitted state and shared row locks, not sequential requests.
const overlap = Effect.fnUntraced(function* <A, R, B, R2>(
  first: Effect.Effect<A, unknown, R>,
  second: Effect.Effect<B, unknown, R2>,
) {
  const transaction = yield* TransactionService;
  const firstReady = yield* Deferred.make<void>();
  const secondStarted = yield* Deferred.make<void>();
  const firstFiber = yield* transaction
    .run(
      Effect.gen(function* () {
        const result = yield* first;
        yield* Deferred.succeed(firstReady, undefined);
        yield* Deferred.await(secondStarted);
        return result;
      }),
    )
    .pipe(Effect.forkChild);
  yield* Deferred.await(firstReady);
  const secondFiber = yield* Effect.gen(function* () {
    yield* Deferred.succeed(secondStarted, undefined);
    return yield* second;
  }).pipe(Effect.forkChild);
  return [yield* Fiber.await(firstFiber), yield* Fiber.await(secondFiber)] as const;
});

layer(fixture.layer)("personal OAuth offboarding", (it) => {
  for (const type of ["cli", "mcp"] as const) {
    it.effect(`${type}: rejects legacy delegations after removal and rejoining`, () =>
      Effect.gen(function* () {
        const context = yield* setup(type);
        yield* context.approve;
        const token = yield* context.exchange;
        if (!token.refreshToken) return yield* Effect.die("Expected refresh token");
        const repository = yield* Repository;
        // Model a member removed before OAuth cleanup was deployed.
        yield* repository.auth.member.remove(
          context.admin.actor.member.organizationMember.id,
          context.admin.owner.organization.id,
          context.admin.actor.member.organizationMember.organizationRoleId,
          yield* DateTime.now,
        );
        const delegated = yield* handledApi(NameraApi, {
          headers: { authorization: `Bearer ${token.accessToken}` },
        });
        expect(yield* delegated.wallet.list().pipe(Effect.flip)).toMatchObject({
          _tag: "Unauthorized",
        });
        const app = yield* Application;
        expect(
          yield* app.oauth.token
            .refresh({ clientId: context.clientId, resource, refreshToken: token.refreshToken })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "INVALID_GRANT" });
        yield* setAuthToken(context.admin.ownerToken);
        const api = yield* makeTestApiClient;
        const rejoined = yield* createMember(api, context.admin.actor.user.email, "admin");
        expect(rejoined.actor.actorId).not.toBe(context.admin.actor.actorId);
        yield* setAuthToken();
        expect(yield* delegated.wallet.list().pipe(Effect.flip)).toMatchObject({
          _tag: "Unauthorized",
        });
        expect(
          yield* app.oauth.token
            .refresh({ clientId: context.clientId, resource, refreshToken: token.refreshToken })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "INVALID_GRANT" });
      }),
    );

    it.effect(`${type}: revokes tokens and grants without revoking shared automation`, () =>
      Effect.gen(function* () {
        const context = yield* setup(type);
        yield* context.approve;
        const token = yield* context.exchange;
        if (!token.refreshToken) return yield* Effect.die("Expected refresh token");
        const delegated = yield* handledApi(NameraApi, {
          headers: { authorization: `Bearer ${token.accessToken}` },
        });
        expect(yield* delegated.wallet.list()).toHaveLength(1);
        const repository = yield* Repository;
        const before = yield* repository.core.sessionKey.findById(
          context.session.id,
          context.admin.owner.organization.id,
        );
        yield* context.remove;
        yield* assertTokensRevoked(token);
        expect(yield* delegated.wallet.list().pipe(Effect.flip)).toMatchObject({
          _tag: "Unauthorized",
        });
        const app = yield* Application;
        expect(
          yield* app.oauth.token
            .refresh({ clientId: context.clientId, resource, refreshToken: token.refreshToken })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "INVALID_GRANT" });
        const authorizations = yield* repository.auth.oauth.authorization.findForOrganization(
          context.admin.owner.organization.id,
        );
        expect(authorizations).toHaveLength(1);
        expect(authorizations[0]?.status).toBe("revoked");
        for (const authorization of authorizations) {
          expect(
            yield* repository.core.sessionKeyGrant.findActiveForActor(
              authorization.organizationId,
              authorization.actorId,
            ),
          ).toEqual([]);
        }
        const automation = yield* handledApi(NameraApi, {
          headers: { "x-api-key": context.shared.key },
        });
        expect((yield* automation.wallet.list()).map((value) => value.id)).toEqual([
          context.wallet.id,
        ]);
        expect(
          yield* repository.core.sessionKey.findById(
            context.session.id,
            context.admin.owner.organization.id,
          ),
        ).toEqual(before);
        const events = yield* repository.audit.organization.findForOrganization(
          context.admin.owner.organization.id,
        );
        expect(
          events.filter((event) => event.event === `${type}_authorization.revoked`),
        ).toHaveLength(1);
      }),
    );

    for (const first of ["approval", "removal"] as const) {
      it.effect(`${type}: ${first} wins consent/removal race`, () =>
        Effect.gen(function* () {
          const context = yield* setup(type);
          const results =
            first === "approval"
              ? yield* overlap(context.approve, context.remove)
              : yield* overlap(context.remove, context.approve);
          expect(Exit.isSuccess(results[0])).toBe(true);
          expect(Exit.isSuccess(results[1])).toBe(first === "approval");
          const repository = yield* Repository;
          const authorizations = yield* repository.auth.oauth.authorization.findForOrganization(
            context.admin.owner.organization.id,
          );
          expect(
            authorizations.filter((authorization) => authorization.status === "active"),
          ).toEqual([]);
          for (const authorization of authorizations) {
            expect(
              yield* repository.core.sessionKeyGrant.findActiveForActor(
                authorization.organizationId,
                authorization.actorId,
              ),
            ).toEqual([]);
          }
        }),
      );
    }

    for (const action of ["exchange", "refresh"] as const) {
      for (const first of ["issuance", "removal"] as const) {
        it.effect(`${type}: ${first} wins ${action}/removal race`, () =>
          Effect.gen(function* () {
            const context = yield* setup(type);
            yield* context.approve;
            const app = yield* Application;
            const token = action === "refresh" ? yield* context.exchange : undefined;
            if (token && !token.refreshToken) return yield* Effect.die("Expected refresh token");
            const issue = token?.refreshToken
              ? app.oauth.token.refresh({
                  clientId: context.clientId,
                  resource,
                  refreshToken: token.refreshToken,
                })
              : context.exchange;
            const results: readonly [
              Exit.Exit<Effect.Success<typeof context.exchange> | void, unknown>,
              Exit.Exit<Effect.Success<typeof context.exchange> | void, unknown>,
            ] =
              first === "issuance"
                ? yield* overlap(issue, context.remove)
                : yield* overlap(context.remove, issue);
            expect(Exit.isSuccess(results[0])).toBe(true);
            expect(Exit.isSuccess(results[1])).toBe(first === "issuance");
            const issued =
              first === "issuance" && Exit.isSuccess(results[0]) ? results[0].value : token;
            if (issued) {
              yield* assertTokensRevoked(issued);
              if (!issued.refreshToken) return yield* Effect.die("Expected refresh token");
              const delegated = yield* handledApi(NameraApi, {
                headers: { authorization: `Bearer ${issued.accessToken}` },
              });
              expect(yield* delegated.wallet.list().pipe(Effect.flip)).toMatchObject({
                _tag: "Unauthorized",
              });
              expect(
                yield* app.oauth.token
                  .refresh({
                    clientId: context.clientId,
                    resource,
                    refreshToken: issued.refreshToken,
                  })
                  .pipe(Effect.flip),
              ).toMatchObject({ code: "INVALID_GRANT" });
            }
          }),
        );
      }
    }
  }
});
