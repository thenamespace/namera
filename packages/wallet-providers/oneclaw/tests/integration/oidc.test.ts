import { generateKeyPairSync } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { ConfigProvider, DateTime, Effect, Layer, Redacted, Schema } from "effect";

import { OrganizationId } from "@namera-ai/protocol";
import { createLocalJWKSet, jwtVerify } from "jose";

import { OneClawOidcService } from "../../src/index.js";

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();
const oidcLayer = (encodedKey: string) =>
  OneClawOidcService.layer.pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          ONECLAW_OIDC_ISSUER: "https://namera.invalid",
          ONECLAW_OIDC_AUDIENCE: "test-app",
          ONECLAW_OIDC_KEY_ID: "test-key",
          ONECLAW_OIDC_PRIVATE_KEY_BASE64: encodedKey,
        }),
      ),
    ),
  );
const Live = oidcLayer(Buffer.from(privateKey).toString("base64"));

for (const { name, encodedKey } of [
  { name: "invalid base64", encodedKey: "invalid-secret!" },
  { name: "unencoded PEM", encodedKey: privateKey },
  { name: "non-PEM content", encodedKey: Buffer.from("not a PEM key").toString("base64") },
]) {
  it.effect(`rejects ${name} OIDC configuration without exposing key material`, () =>
    Effect.gen(function* () {
      const error = yield* Effect.gen(function* () {
        yield* OneClawOidcService;
      }).pipe(Effect.provide(oidcLayer(encodedKey)), Effect.flip);
      expect(error).toMatchObject({ code: "CONFIGURATION_INVALID", operation: "oidc.configure" });
      if (encodedKey) expect(JSON.stringify(error)).not.toContain(encodedKey);
      expect(JSON.stringify(error)).not.toContain("PRIVATE KEY");
    }),
  );
}

it.effect("requires a nonempty base64 key setting", () =>
  Effect.gen(function* () {
    const error = yield* Effect.gen(function* () {
      yield* OneClawOidcService;
    }).pipe(Effect.provide(oidcLayer("")), Effect.flip);
    expect(error).toHaveProperty("_tag", "ConfigError");
  }),
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
    expect(verified.payload).toMatchObject({
      sub: `namera:org:${organizationId}`,
      email: "org@example.invalid",
      email_verified: true,
      name: "Org",
    });
    expect(verified.protectedHeader).toMatchObject({ kid: "test-key", alg: "RS256", typ: "JWT" });
    expect(verified.payload.exp).toBe(Number(verified.payload.iat) + 120);
    expect(jwks.keys).toHaveLength(1);
    expect(Object.keys(jwks.keys[0] ?? {}).toSorted()).toEqual([
      "alg",
      "e",
      "kid",
      "kty",
      "n",
      "use",
    ]);
    yield* Effect.promise(() =>
      expect(
        jwtVerify(Redacted.value(token), createLocalJWKSet(jwks), {
          issuer: "https://namera.invalid",
          audience: "test-app",
          currentDate: new Date(DateTime.toEpochMillis(now) + 120_000),
          algorithms: ["RS256"],
        }),
      ).rejects.toMatchObject({ code: "ERR_JWT_EXPIRED" }),
    );
    expect(JSON.stringify(token)).not.toContain(Redacted.value(token));
  }).pipe(Effect.provide(Live)),
);
