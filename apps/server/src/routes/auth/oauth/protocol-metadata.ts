import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

import { AuthConfig } from "@namera-ai/application";

const publicCacheHeaders = { "cache-control": "public, max-age=300" } as const;

export const OAuthAuthorizationServerMetadataRoute = HttpRouter.add(
  "GET",
  "/.well-known/oauth-authorization-server",
  () =>
    Effect.gen(function* () {
      const config = yield* AuthConfig;
      const issuer = config.apiPublicOrigin.toString().replace(/\/$/, "");
      return HttpServerResponse.jsonUnsafe(
        {
          issuer,
          authorization_endpoint: `${issuer}/oauth/authorize`,
          device_authorization_endpoint: `${issuer}/oauth/device/authorize`,
          registration_endpoint: `${issuer}/oauth/register`,
          token_endpoint: `${issuer}/oauth/token`,
          revocation_endpoint: `${issuer}/oauth/revoke`,
          response_types_supported: ["code"],
          grant_types_supported: [
            "authorization_code",
            "refresh_token",
            "urn:ietf:params:oauth:grant-type:device_code",
          ],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
          scopes_supported: [
            "mcp:read",
            "mcp:execute",
            "wallet:read",
            "session-key:read",
            "execution:read",
            "execution:execute",
            "signature:create",
            "offline_access",
          ],
        },
        { headers: publicCacheHeaders },
      );
    }),
);

export const protectedResourceMetadataRoute = (path: `/${string}`) =>
  HttpRouter.add("GET", path, () =>
    Effect.gen(function* () {
      const config = yield* AuthConfig;
      const issuer = config.apiPublicOrigin.toString().replace(/\/$/, "");
      return HttpServerResponse.jsonUnsafe(
        {
          resource: path.endsWith("/mcp") ? `${issuer}/mcp` : issuer,
          authorization_servers: [issuer],
          bearer_methods_supported: ["header"],
          scopes_supported: ["mcp:read", "mcp:execute"],
        },
        { headers: publicCacheHeaders },
      );
    }),
  );
