import { generateKeyPairSync } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { ConfigProvider, DateTime, Effect, Layer, Redacted, Schema } from "effect";

import { OrganizationId } from "@namera-ai/protocol";
import { createLocalJWKSet, jwtVerify } from "jose";

import { OneClawOidcService } from "../../src/index.js";

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();
const Live = OneClawOidcService.layer.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        ONECLAW_OIDC_ISSUER: "https://namera.invalid",
        ONECLAW_OIDC_AUDIENCE: "test-app",
        ONECLAW_OIDC_KEY_ID: "test-key",
        ONECLAW_OIDC_PRIVATE_KEY: privateKey,
      }),
    ),
  ),
);

it.effect("issues short-lived organization identity tokens and exports only public JWKS", () =>
  Effect.gen(function* () {
    const service = yield* OneClawOidcService;
    const organizationId = Schema.decodeUnknownSync(OrganizationId)(
      "01950000-0000-7000-8000-000000000001",
    );
    const token = yield* service.issue({
      organizationId,
      email: "org@example.invalid",
      displayName: "Org",
    });
    const jwks = yield* service.publicJwks;
    const now = yield* DateTime.now;
    const verified = yield* Effect.promise(() =>
      jwtVerify(Redacted.value(token), createLocalJWKSet(jwks), {
        issuer: "https://namera.invalid",
        audience: "test-app",
        currentDate: new Date(DateTime.toEpochMillis(now)),
        algorithms: ["RS256"],
      }),
    );
    expect(verified.payload.sub).toBe(`namera:org:${organizationId}`);
    expect(verified.payload.exp).toBe(Number(verified.payload.iat) + 120);
    expect(jwks.keys).toHaveLength(1);
    expect(Object.keys(jwks.keys[0] ?? {})).toEqual(["kty", "n", "e", "kid", "alg", "use"]);
    expect(JSON.stringify(token)).not.toContain(Redacted.value(token));
  }).pipe(Effect.provide(Live)),
);
