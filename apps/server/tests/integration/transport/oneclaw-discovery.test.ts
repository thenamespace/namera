import { generateKeyPairSync } from "node:crypto";

import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
  HttpClientRequest,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

import { OneClawDiscoveryRoutes } from "#/routes/oneclaw";

import { makeTestConfigLayer } from "../../fixtures/layers/config.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = makeTestConfigLayer({
  ONECLAW_PLATFORM_APP_ID: "test-app",
  ONECLAW_PLATFORM_API_KEY: "test-platform-key",
  ONECLAW_EMPTY_TEMPLATE_ID: "test-template",
  ONECLAW_EMPTY_TEMPLATE_VERSION: "1",
  ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
  ONECLAW_OIDC_ISSUER: "http://api.test/providers/1claw",
  ONECLAW_OIDC_AUDIENCE: "test-audience",
  ONECLAW_OIDC_KEY_ID: "test-key",
  ONECLAW_OIDC_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
});

layer(HttpServer.layerServices)("1Claw OIDC discovery", (it) => {
  it.effect("serves matching issuer metadata and public RSA material only", () =>
    Effect.gen(function* () {
      const handler = yield* HttpRouter.toHttpEffect(
        OneClawDiscoveryRoutes.pipe(Layer.provide(config)),
      );
      const read = Effect.fnUntraced(function* (path: string) {
        const request = HttpClientRequest.get(`http://api.test${path}`);
        const response = yield* handler.pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromClientRequest(request),
          ),
        );
        expect(response.status).toBe(200);
        return yield* HttpServerResponse.toClientResponse(response, { request }).json;
      });
      expect(yield* read("/providers/1claw/.well-known/openid-configuration")).toMatchObject({
        issuer: "http://api.test/providers/1claw",
        jwks_uri: "http://api.test/providers/1claw/jwks.json",
      });
      const jwks = yield* read("/providers/1claw/jwks.json");
      expect(jwks).toMatchObject({
        keys: [{ kty: "RSA", kid: "test-key", alg: "RS256", use: "sig" }],
      });
      expect(JSON.stringify(jwks)).not.toMatch(
        /"(?:d|p|q|dp|dq|qi)"|PRIVATE KEY|test-platform-key/,
      );
    }),
  );
});
