import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";

import { AuthConfig } from "@namera-ai/application";
import { OneClawOidcConfig, OneClawOidcService } from "@namera-ai/wallet-provider-oneclaw";

import { OneClawLive } from "#/layers/services";

export const OneClawDiscoveryRoutes = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* OneClawOidcConfig;
    const auth = yield* AuthConfig;
    const issuer = `${auth.apiPublicOrigin.origin}/providers/1claw`;
    if (config.issuer !== issuer)
      return yield* Effect.die(
        "ONECLAW_OIDC_ISSUER must match the API origin followed by /providers/1claw",
      );
    return Layer.merge(
      HttpRouter.add(
        "GET",
        "/providers/1claw/.well-known/openid-configuration",
        HttpServerResponse.jsonUnsafe({
          issuer,
          jwks_uri: `${issuer}/jwks.json`,
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
        }),
      ),
      HttpRouter.add(
        "GET",
        "/providers/1claw/jwks.json",
        Effect.gen(function* () {
          const oidc = yield* OneClawOidcService;
          return HttpServerResponse.jsonUnsafe(yield* oidc.publicJwks);
        }),
      ).pipe(HttpRouter.provideRequest(OneClawLive)),
    );
  }),
);
