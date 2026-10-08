import { expect, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { HttpClientRequest } from "effect/http";

import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { OAuthDynamicClientRegistrationResponse } from "@namera-ai/protocol/dto";

import {
  makeOAuthProtocolClient,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../../../fixtures/index.js";
import { registerPendingLocalSession } from "../../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();
const redirectUri = "https://agent.example/callback";
const resource = "http://api.test";
const verifier = "a".repeat(64);

layer(fixture.layer)("OAuth code binding", (it) => {
  it.effect("rejects substituted bindings without consuming the legitimate client's code", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("oauth-bindings@example.com"));
      const protocol = yield* makeOAuthProtocolClient();
      const registrations = yield* Effect.forEach(["Owner client", "Other client"], (name) =>
        Effect.gen(function* () {
          const response = yield* protocol.execute(
            HttpClientRequest.post(`${resource}/oauth/register`).pipe(
              HttpClientRequest.bodyJsonUnsafe({
                client_name: name,
                redirect_uris: [redirectUri],
                grant_types: ["authorization_code", "refresh_token"],
                response_types: ["code"],
                token_endpoint_auth_method: "none",
              }),
            ),
          );
          expect(response.status).toBe(201);
          return yield* Schema.decodeUnknownEffect(OAuthDynamicClientRegistrationResponse)(
            yield* response.json,
          );
        }),
      );
      const [registered, other] = registrations;
      if (!registered || !other) return yield* Effect.die("Expected both registered clients");
      const { session: pending } = yield* registerPendingLocalSession(client, ["eip155:1"]);
      const session = yield* fixture.confirmOperation(client, pending, "install");
      const app = yield* Application;
      const started = yield* app.oauth.request.start({
        clientId: registered.client_id,
        redirectUri,
        responseType: "code",
        codeChallenge: yield* (yield* CryptoService).sha256(verifier),
        codeChallengeMethod: "S256",
        resource,
        scopes: ["mcp:read", "offline_access"],
        state: "opaque state + / & ? =",
      });
      const approval = yield* client.oauth.approveOAuthAuthorizationRequest({
        payload: {
          requestId: started.request.id,
          organizationId: owner.actor.organization.id,
          sessionKeyIds: [session.id],
          expiresAt: null,
        },
      });
      const callback = new URL(approval.redirectUrl);
      expect(callback.origin + callback.pathname).toBe(redirectUri);
      expect(callback.searchParams.get("state")).toBe("opaque state + / & ? =");
      const code = callback.searchParams.get("code");
      if (code === null) return yield* Effect.die("Expected authorization code");
      const valid = {
        grant_type: "authorization_code",
        code,
        client_id: registered.client_id,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        resource,
      };
      for (const substitution of [
        { client_id: other.client_id },
        { redirect_uri: `${redirectUri}/` },
        { resource: `${resource}/` },
        { code_verifier: "b".repeat(64) },
      ]) {
        const denied = yield* protocol.execute(
          HttpClientRequest.post(`${resource}/oauth/token`).pipe(
            HttpClientRequest.bodyUrlParams({ ...valid, ...substitution }),
          ),
        );
        expect(denied.status).toBe(400);
        expect(denied.headers["cache-control"]).toBe("no-store");
        expect(yield* denied.json).toMatchObject({ error: "invalid_grant" });
      }
      const request = HttpClientRequest.post(`${resource}/oauth/token`).pipe(
        HttpClientRequest.bodyUrlParams(valid),
      );
      const issued = yield* protocol.execute(request);
      expect(issued.status).toBe(200);
      expect(yield* issued.json).toMatchObject({
        token_type: "Bearer",
        access_token: expect.any(String),
        refresh_token: expect.any(String),
      });
      const replay = yield* protocol.execute(request);
      expect(replay.status).toBe(400);
      expect(yield* replay.json).toMatchObject({ error: "invalid_grant" });
    }),
  );
});
