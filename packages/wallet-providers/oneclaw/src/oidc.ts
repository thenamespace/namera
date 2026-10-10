import { Context, DateTime, Effect, Layer, Redacted } from "effect";

import type { OrganizationId } from "@namera-ai/protocol";
import { exportJWK, importPKCS8, SignJWT } from "jose";

import { OneClawOidcConfig } from "#/config";
import { oneClawError } from "#/errors";

const makeOidc = Effect.gen(function* () {
  const config = yield* OneClawOidcConfig;
  const key = yield* Effect.tryPromise({
    try: () =>
      importPKCS8(Redacted.value(config.privateKey).replaceAll("\\n", "\n"), "RS256", {
        extractable: true,
      }),
    catch: () => oneClawError("oidc.configure", "CONFIGURATION_INVALID"),
  });
  const material = yield* Effect.tryPromise({
    try: () => exportJWK(key),
    catch: () => oneClawError("oidc.configure", "CONFIGURATION_INVALID"),
  });
  if (material.kty !== "RSA" || material.n === undefined || material.e === undefined) {
    return yield* oneClawError("oidc.configure", "CONFIGURATION_INVALID");
  }
  // Explicit public-field projection: private JWK fields must never reach JWKS.
  const jwks = {
    keys: [
      { kty: "RSA", n: material.n, e: material.e, kid: config.keyId, alg: "RS256", use: "sig" },
    ],
  };
  return {
    publicJwks: Effect.succeed(jwks),
    issue: Effect.fnUntraced(function* (input: {
      readonly organizationId: OrganizationId;
      readonly email: string;
      readonly displayName: string;
    }) {
      const now = yield* DateTime.now;
      const issuedAt = Math.floor(DateTime.toEpochMillis(now) / 1000);
      const token = yield* Effect.tryPromise({
        try: () =>
          new SignJWT({ email: input.email, email_verified: true, name: input.displayName })
            .setProtectedHeader({ alg: "RS256", kid: config.keyId, typ: "JWT" })
            .setIssuer(config.issuer)
            .setAudience(config.audience)
            .setSubject(`namera:org:${input.organizationId}`)
            .setIssuedAt(issuedAt)
            .setExpirationTime(issuedAt + 120)
            .sign(key),
        catch: () => oneClawError("oidc.issue", "CONFIGURATION_INVALID"),
      });
      return Redacted.make(token);
    }),
  };
});

export class OneClawOidcService extends Context.Service<
  OneClawOidcService,
  Effect.Success<typeof makeOidc>
>()("@namera-ai/wallet-provider-oneclaw/OneClawOidcService") {
  static readonly layer = Layer.effect(OneClawOidcService, makeOidc);
}
