import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { ExecutionId, ExecutionSubmissionId, Hex, SignatureOperationId } from "@namera-ai/protocol";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();
const clientId = "local-mcp-test";
const redirectUri = "http://127.0.0.1:49152/callback";
const verifier = "a".repeat(64);

const setup = Effect.fnUntraced(function* (resource = "http://api.test") {
  yield* resetTestState();
  const api = yield* makeTestApiClient;
  const owner = yield* signIn(api, testEmail(`oauth-api-${crypto.randomUUID()}@example.com`));
  const wallet = yield* createTestPasskeyWallet(api, "Local MCP wallet");
  const pending = yield* api.sessionKey.create({ payload: yield* localSessionRequest(wallet.id) });
  const session = yield* fixture.confirmOperation(api, pending, "install");
  const repository = yield* Repository;
  yield* repository.auth.oauth.client.insertPreRegistered({
    clientId,
    clientName: "Local MCP",
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
  const app = yield* Application;
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
  const approved = yield* api.oauth.approveOAuthAuthorizationRequest({
    payload: {
      requestId: started.request.id,
      organizationId: owner.actor.organization.id,
      sessionKeyIds: [session.id],
      expiresAt: null,
    },
  });
  const code = new URL(approved.redirectUrl).searchParams.get("code");
  if (code === null) return yield* Effect.die("Expected code");
  const token = yield* app.oauth.token.exchangeAuthorizationCode({
    code,
    clientId,
    redirectUri,
    codeVerifier: verifier,
    resource,
  });
  yield* setAuthToken();
  const delegated = yield* handledApi(NameraApi, {
    headers: { authorization: `Bearer ${token.accessToken}` },
  });
  return { api, delegated, token, wallet, session, owner };
});

layer(fixture.layer)("MCP API audience", (it) => {
  it.effect("uses only granted resources and current token scopes after refresh narrowing", () =>
    Effect.gen(function* () {
      const { delegated, token, wallet, session } = yield* setup();
      expect(yield* delegated.session.currentActor()).toMatchObject({ type: "mcp" });
      expect((yield* delegated.wallet.list()).map((value) => value.id)).toEqual([wallet.id]);
      expect((yield* delegated.sessionKey.listForOrganization()).map((value) => value.id)).toEqual([
        session.id,
      ]);
      expect(yield* delegated.session.currentUser().pipe(Effect.flip)).toMatchObject({
        _tag: "Forbidden",
      });
      if (token.refreshToken === undefined) return yield* Effect.die("Expected refresh token");
      const app = yield* Application;
      const narrowed = yield* app.oauth.token.refresh({
        refreshToken: token.refreshToken,
        clientId,
        resource: "http://api.test",
        scopes: ["mcp:read"],
      });
      const readOnly = yield* handledApi(NameraApi, {
        headers: { authorization: `Bearer ${narrowed.accessToken}` },
      });
      expect(yield* readOnly.session.currentActor()).toMatchObject({
        type: "mcp",
        data: { authorization: { scopes: ["mcp:read"] } },
      });
      expect(yield* readOnly.wallet.list()).toHaveLength(1);
      expect(
        yield* readOnly.signature
          .prepare({
            headers: { "idempotency-key": crypto.randomUUID() },
            payload: {
              namespace: "eip155",
              walletId: wallet.id,
              sessionKeyId: session.id,
              chainId: "eip155:11155111",
              type: "message",
              message: "hello",
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      expect(
        yield* readOnly.execution
          .simulate({
            payload: {
              namespace: "eip155",
              walletId: wallet.id,
              sessionKeyId: session.id,
              chainId: "eip155:11155111",
              calls: [{ to: wallet.address, value: 0n, data: "0x" }],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      const completions: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
        readOnly.execution.complete({
          payload: {
            namespace: "eip155",
            submissionId: ExecutionSubmissionId.make("01900000-0000-7000-8000-000000000012"),
            signature: Hex.make(`0x${"11".repeat(65)}`),
          },
        }),
        readOnly.signature.complete({
          payload: {
            namespace: "eip155",
            operationId: SignatureOperationId.make("01900000-0000-7000-8000-000000000013"),
            signature: Hex.make(`0x${"11".repeat(65)}`),
          },
        }),
      ];
      for (const complete of completions) {
        expect(yield* complete.pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
      }
    }),
  );

  it.effect("rejects requests for the removed hosted MCP audience", () =>
    Effect.gen(function* () {
      expect(yield* setup("http://api.test/mcp").pipe(Effect.flip)).toMatchObject({
        _tag: "OAuthAuthorizationRequestError",
        code: "INVALID_RESOURCE",
      });
    }),
  );

  it.effect("does not infer read authority from an execute-only narrowed token", () =>
    Effect.gen(function* () {
      const { token, wallet, session } = yield* setup();
      if (token.refreshToken === undefined) return yield* Effect.die("Expected refresh token");
      const app = yield* Application;
      const narrowed = yield* app.oauth.token.refresh({
        refreshToken: token.refreshToken,
        clientId,
        resource: "http://api.test",
        scopes: ["mcp:execute"],
      });
      const executeOnly = yield* handledApi(NameraApi, {
        headers: { authorization: `Bearer ${narrowed.accessToken}` },
      });
      expect(yield* executeOnly.session.currentActor()).toMatchObject({
        type: "mcp",
        data: { authorization: { scopes: ["mcp:execute"] } },
      });

      const reads: ReadonlyArray<{
        name: string;
        request: Effect.Effect<unknown, unknown>;
      }> = [
        { name: "wallet list", request: executeOnly.wallet.list() },
        {
          name: "wallet detail",
          request: executeOnly.wallet.get({ params: { walletId: wallet.id } }),
        },
        {
          name: "portfolio",
          request: executeOnly.wallet.getPortfolio({ params: { walletId: wallet.id }, query: {} }),
        },
        { name: "session list", request: executeOnly.sessionKey.listForOrganization() },
        {
          name: "wallet sessions",
          request: executeOnly.sessionKey.listForWallet({ params: { walletId: wallet.id } }),
        },
        {
          name: "session detail",
          request: executeOnly.sessionKey.get({ params: { sessionKeyId: session.id } }),
        },
        { name: "execution history", request: executeOnly.execution.list({ query: {} }) },
        {
          name: "execution detail",
          request: executeOnly.execution.get({
            params: { executionId: ExecutionId.make("01900000-0000-7000-8000-000000000010") },
          }),
        },
        {
          name: "submission",
          request: executeOnly.execution.getSubmission({
            params: {
              submissionId: ExecutionSubmissionId.make("01900000-0000-7000-8000-000000000011"),
            },
          }),
        },
        {
          name: "signature verification",
          request: executeOnly.signature.verify({
            payload: {
              namespace: "eip155",
              walletId: wallet.id,
              chainId: "eip155:1",
              type: "message",
              message: "scope test",
              signature: "0x",
            },
          }),
        },
      ];
      for (const { name, request } of reads) {
        expect(yield* request.pipe(Effect.flip), name).toMatchObject({ _tag: "Forbidden" });
      }
    }),
  );

  it.effect("removes a live OAuth token's resource access when its session is revoked", () =>
    Effect.gen(function* () {
      const { api, delegated, owner, wallet, session } = yield* setup();
      expect((yield* delegated.wallet.get({ params: { walletId: wallet.id } })).id).toBe(wallet.id);
      yield* setAuthToken(owner.cookie.value);
      yield* api.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      yield* setAuthToken();

      // Consent and the token remain valid; only the wallet authority has been removed.
      expect(yield* delegated.session.currentActor()).toMatchObject({ type: "mcp" });
      expect(yield* delegated.wallet.list()).toEqual([]);
      expect(yield* delegated.sessionKey.listForOrganization()).toEqual([]);
      expect(
        yield* delegated.wallet
          .getPortfolio({ params: { walletId: wallet.id }, query: {} })
          .pipe(Effect.flip),
      ).toMatchObject({
        _tag: "WalletError",
        code: "WALLET_NOT_FOUND",
      });
      expect(
        yield* delegated.sessionKey.get({ params: { sessionKeyId: session.id } }).pipe(Effect.flip),
      ).toMatchObject({
        _tag: "SessionKeyError",
        code: "SESSION_KEY_NOT_FOUND",
      });
      expect(
        yield* delegated.execution
          .simulate({
            payload: {
              namespace: "eip155",
              walletId: wallet.id,
              sessionKeyId: session.id,
              chainId: "eip155:1",
              calls: [{ to: wallet.address, value: 0n, data: "0x" }],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({
        _tag: "ExecutionError",
        code: "NO_AUTHORIZED_SESSION_KEY",
      });
    }),
  );

  it.effect("rejects authorization revocation immediately", () =>
    Effect.gen(function* () {
      const { api, delegated, owner } = yield* setup();
      const actor = yield* delegated.session.currentActor();
      if (actor.type !== "mcp") return yield* Effect.die("Expected MCP actor");
      yield* setAuthToken(owner.cookie.value);
      yield* api.oauth.revokeMcpAuthorization({
        payload: { authorizationId: actor.data.authorization.id },
      });
      yield* setAuthToken();
      expect(yield* delegated.wallet.list().pipe(Effect.flip)).toMatchObject({
        _tag: "Unauthorized",
      });
    }),
  );
});
