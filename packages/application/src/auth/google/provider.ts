import { Config, Context, Effect, Layer, Metric, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { GoogleAuthError } from "@namera-ai/protocol";
import type { GoogleIdentity } from "@namera-ai/protocol/model";
import { googleAuthDuration, googleAuthResults } from "@namera-ai/telemetry";
import { createRemoteJWKSet } from "jose";

import { verifyGoogleIdToken } from "./id-token.js";

const TokenResponse = Schema.Struct({ id_token: Schema.NonEmptyString });

export class GoogleIdentityProvider extends Context.Service<
  GoogleIdentityProvider,
  {
    readonly enabled: boolean;
    readonly authorizationUrl: (input: {
      state: string;
      nonce: string;
      challenge: string;
      redirectUri: string;
    }) => string;
    readonly exchange: (input: {
      code: string;
      verifier: string;
      redirectUri: string;
    }) => Effect.Effect<{ identity: GoogleIdentity; nonce: string }, GoogleAuthError>;
  }
>()("@namera-ai/application/GoogleIdentityProvider") {
  static readonly layer = Layer.effect(
    GoogleIdentityProvider,
    Effect.gen(function* () {
      const config = yield* Config.all({
        clientId: Config.String("GOOGLE_CLIENT_ID").pipe(Config.withDefault("")),
        clientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET").pipe(
          Config.withDefault(Redacted.make("")),
        ),
      });
      const enabled = config.clientId.length > 0 && Redacted.value(config.clientSecret).length > 0;
      if (config.clientId.length > 0 !== Redacted.value(config.clientSecret).length > 0) {
        return yield* Effect.die(
          "Configure both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
        );
      }
      const client = yield* HttpClient.HttpClient;
      const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
        timeoutDuration: 10_000,
      });
      const exchange = Effect.fn("application.google.provider.exchange")(
        function* (input: { code: string; verifier: string; redirectUri: string }) {
          if (!enabled) return yield* new GoogleAuthError({ code: "GOOGLE_NOT_CONFIGURED" });
          // OAuth credentials and responses must not enter automatic HTTP tracing.
          const response = yield* client
            .execute(
              HttpClientRequest.post("https://oauth2.googleapis.com/token").pipe(
                HttpClientRequest.bodyUrlParams({
                  code: input.code,
                  code_verifier: input.verifier,
                  redirect_uri: input.redirectUri,
                  client_id: config.clientId,
                  client_secret: Redacted.value(config.clientSecret),
                  grant_type: "authorization_code",
                }),
              ),
            )
            .pipe(
              Effect.withTracerEnabled(false),
              Effect.timeout("10 seconds"),
              Effect.mapError(() => new GoogleAuthError({ code: "GOOGLE_UNAVAILABLE" })),
            );
          if (response.status !== 200)
            return yield* new GoogleAuthError({ code: "GOOGLE_IDENTITY_INVALID" });
          const tokens = yield* response.json.pipe(
            Effect.timeout("10 seconds"),
            Effect.flatMap(Schema.decodeUnknownEffect(TokenResponse)),
            Effect.mapError(() => new GoogleAuthError({ code: "GOOGLE_IDENTITY_INVALID" })),
          );
          return yield* verifyGoogleIdToken(tokens.id_token, config.clientId, keys);
        },
        Effect.tapError((error) =>
          Metric.update(
            Metric.withAttributes(googleAuthResults, { stage: "provider", result: error.code }),
            1,
          ),
        ),
        Effect.trackDuration(Metric.withAttributes(googleAuthDuration, { stage: "provider" })),
      );
      return GoogleIdentityProvider.of({
        enabled,
        authorizationUrl: (input) => {
          const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
          url.search = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: input.redirectUri,
            response_type: "code",
            scope: "openid email profile",
            state: input.state,
            nonce: input.nonce,
            code_challenge: input.challenge,
            code_challenge_method: "S256",
            prompt: "select_account",
          }).toString();
          return url.toString();
        },
        exchange,
      });
    }),
  );
}
