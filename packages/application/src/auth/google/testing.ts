import { Effect, Layer } from "effect";

import { GoogleAuthError } from "@namera-ai/protocol";
import type { GoogleIdentity } from "@namera-ai/protocol/model";

import { GoogleIdentityProvider } from "./provider.js";

// Owned by the provider boundary; tests never replace application workflows.
export const googleIdentityTestLayer = (
  identities: Readonly<Record<string, GoogleIdentity>> = {},
) =>
  Layer.succeed(
    GoogleIdentityProvider,
    GoogleIdentityProvider.of({
      enabled: true,
      authorizationUrl: (input) => {
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.search = new URLSearchParams({
          state: input.state,
          nonce: input.nonce,
          code_challenge: input.challenge,
          redirect_uri: input.redirectUri,
        }).toString();
        return url.toString();
      },
      exchange: ({ code }) => {
        const [name, nonce = ""] = code.split(":");
        const identity = name ? identities[name] : undefined;
        return identity
          ? Effect.succeed({ identity, nonce })
          : Effect.fail(new GoogleAuthError({ code: "GOOGLE_IDENTITY_INVALID" }));
      },
    }),
  );
