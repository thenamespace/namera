import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Database, Repository } from "@namera-ai/database";

import { CorsMiddleware } from "#/middlewares/cors";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../../fixtures/index.js";
import { makeTestConfigLayer } from "../../../fixtures/layers/config.js";
import { registerPendingLocalSession } from "../../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();

layer(fixture.layer)("OAuth management Origin", (it) => {
  it.effect("guards every consent mutation and device claim before durable changes", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("oauth-origin@example.com"));
      const { session: pending } = yield* registerPendingLocalSession(client, ["eip155:1"]);
      const session = yield* fixture.confirmOperation(client, pending, "install");
      const app = yield* Application;
      const repository = yield* Repository;
      const db = yield* Database;
      const registered = yield* app.oauth.registration.register({
        redirect_uris: ["https://client.example/callback"],
        grant_types: ["authorization_code", "refresh_token"],
      });
      const challenge = yield* (yield* CryptoService).sha256("a".repeat(64));
      const startMcp = app.oauth.request.start({
        clientId: registered.client_id,
        redirectUri: "https://client.example/callback",
        responseType: "code",
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        resource: "http://api.test",
        scopes: ["mcp:read", "offline_access"],
        state: null,
      });
      const startDevice = app.oauth.device.start({
        clientId: "namera-cli",
        scopes: ["wallet:read", "offline_access"],
        resource: "http://api.test",
        deviceName: "Origin fixture",
        cliVersion: "0.1.0",
        platform: "test",
      });
      const claimDevice = Effect.gen(function* () {
        const started = yield* startDevice;
        const claimed = yield* client.oauth.getOAuthDeviceAuthorization({
          query: { userCode: started.userCode },
        });
        return { started, claimed };
      });
      const mcpPayload = {
        organizationId: owner.actor.organization.id,
        sessionKeyIds: [session.id],
        expiresAt: null,
      };
      const devicePayload = {
        organizationId: owner.actor.organization.id,
        sessionKeyIds: [session.id],
      };
      const mcpForRevoke = yield* startMcp;
      const approved = yield* client.oauth.approveOAuthAuthorizationRequest({
        payload: { ...mcpPayload, requestId: mcpForRevoke.request.id },
      });
      const code = new URL(approved.redirectUrl).searchParams.get("code");
      if (!code) return yield* Effect.die("Expected authorization code");
      yield* app.oauth.token.exchangeAuthorizationCode({
        code,
        clientId: registered.client_id,
        redirectUri: "https://client.example/callback",
        codeVerifier: "a".repeat(64),
        resource: "http://api.test",
      });
      const [mcp] = yield* client.oauth.listMcpAuthorizations();
      if (!mcp) return yield* Effect.die("Expected MCP authorization");
      const deviceForRevoke = yield* claimDevice;
      yield* client.oauth.approveOAuthDeviceAuthorization({
        payload: { ...devicePayload, deviceAuthorizationId: deviceForRevoke.claimed.id },
      });
      yield* app.oauth.device.exchange({
        deviceCode: deviceForRevoke.started.deviceCode,
        clientId: "namera-cli",
        resource: "http://api.test",
      });
      const [cli] = yield* client.oauth.listCliAuthorizations();
      if (!cli) return yield* Effect.die("Expected CLI authorization");
      const unclaimed = yield* startDevice;
      const cases = [
        { path: `/oauth/device-authorizations?userCode=${unclaimed.userCode}`, payload: undefined },
        {
          path: "/oauth/authorization-requests/approve",
          payload: {
            ...mcpPayload,
            requestId: (yield* startMcp).request.id,
          },
        },
        {
          path: "/oauth/authorization-requests/deny",
          payload: { requestId: (yield* startMcp).request.id },
        },
        {
          path: "/oauth/device-authorizations/approve",
          payload: {
            ...devicePayload,
            deviceAuthorizationId: (yield* claimDevice).claimed.id,
          },
        },
        {
          path: "/oauth/device-authorizations/deny",
          payload: {
            deviceAuthorizationId: (yield* claimDevice).claimed.id,
          },
        },
        { path: "/oauth/authorizations/revoke", payload: { authorizationId: mcp.id } },
        { path: "/oauth/cli-authorizations/revoke", payload: { authorizationId: cli.id } },
      ];
      const snapshot = Effect.gen(function* () {
        return {
          requests: yield* db.query.oauthAuthorizationRequest.findMany(),
          devices: yield* db.query.oauthDeviceAuthorization.findMany(),
          authorizations: yield* db.query.oauthAuthorization.findMany(),
          codes: yield* db.query.oauthAuthorizationCode.findMany(),
          tokens: yield* db.query.oauthToken.findMany(),
          actors: yield* db.query.actor.findMany(),
          grants: yield* db.query.sessionKeyGrant.findMany(),
          audit: yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          ),
          notifications: yield* client.notification.list({ query: {} }),
          emails: yield* db.query.emailJob.findMany(),
        };
      });
      const handler = yield* HttpRouter.toHttpEffect(
        Layer.merge(
          HttpApiBuilder.layer(NameraApi),
          CorsMiddleware.pipe(
            Layer.provide(makeTestConfigLayer({ SERVER_CORS_ORIGIN: "http://dashboard.test" })),
          ),
        ),
      );
      for (const { path, payload } of cases) {
        for (const origin of [
          undefined,
          "null",
          "https://evil.example",
          "http://untrusted.api.test",
          "http://dashboard.test",
        ]) {
          for (const contentType of payload === undefined || origin === "http://dashboard.test"
            ? [undefined]
            : [undefined, "text/plain", "application/json"]) {
            const before = yield* snapshot;
            const request = new Request(`http://api.test${path}`, {
              method: payload === undefined ? "GET" : "POST",
              headers: {
                cookie: `auth-token=${owner.cookie.value}`,
                ...(origin === undefined ? {} : { origin }),
                ...(contentType === undefined ? {} : { "content-type": contentType }),
              },
              ...(payload === undefined
                ? {}
                : { body: new TextEncoder().encode(JSON.stringify(payload)) }),
            });
            let response: HttpServerResponse.HttpServerResponse | undefined;
            yield* HttpEffect.toHandled(handler, (_, result) =>
              Effect.sync(() => {
                response = result;
              }),
            ).pipe(
              Effect.provideService(
                HttpServerRequest.HttpServerRequest,
                HttpServerRequest.fromWeb(request),
              ),
            );
            expect(response?.headers["cache-control"]).toBe("no-store");
            if (origin === "http://dashboard.test") {
              expect(response?.status).toBe(200);
              expect(yield* snapshot).not.toEqual(before);
            } else {
              expect(response?.status).toBe(contentType === "text/plain" ? 415 : 403);
              expect(yield* snapshot).toEqual(before);
            }
          }
        }
      }
      expect(
        (yield* repository.auth.oauth.authorization.findById(mcp.id, owner.actor.organization.id))
          ?.status,
      ).toBe("revoked");
      expect(
        (yield* repository.auth.oauth.authorization.findById(cli.id, owner.actor.organization.id))
          ?.status,
      ).toBe("revoked");
    }),
  );
});
