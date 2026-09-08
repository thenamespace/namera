import { createHash } from "node:crypto";

import { NodeCrypto } from "@effect/platform-node";
import { Clock, Effect, Layer, Redacted, Ref } from "effect";
import { TestClock } from "effect/testing";

import { buildLocalMcpOAuth } from "../../src/services/mcp/oauth-broker.js";
import { McpOAuthUpstream, type LocalOAuthError } from "../../src/services/mcp/oauth-contracts.js";
import { localMcpUrls } from "../../src/services/mcp/transport-security.js";

export const mcpTestLayer = Layer.mergeAll(NodeCrypto.layer, TestClock.layer());
export const urls = localMcpUrls(3847);
export const apiOrigin = "https://api.namera.example";
export const agentRedirect = "http://127.0.0.1:9090/callback";
export const verifier = "v".repeat(43);
export const challenge = createHash("sha256").update(verifier).digest("base64url");

export const makeMcpOAuthFixture = Effect.fn("test.makeMcpOAuthFixture")(function* (options?: {
  readonly beforeExchange?: Effect.Effect<void, LocalOAuthError>;
  readonly beforeRefresh?: Effect.Effect<void, LocalOAuthError>;
}) {
  const exchanges = yield* Ref.make<
    readonly { readonly verifier: string; readonly clientId: string; readonly code: string }[]
  >([]);
  const refreshes = yield* Ref.make(0);
  const revocations = yield* Ref.make(0);
  const credentials = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    return {
      accessToken: Redacted.make("upstream-access-token"),
      refreshToken: Redacted.make("upstream-refresh-token"),
      expiresAt: now + 3_600_000,
      scopes: ["mcp:read", "mcp:execute", "offline_access"],
    };
  });
  const upstream = McpOAuthUpstream.of({
    register: (name) => Effect.succeed(`upstream-${name}`),
    exchange: (input) =>
      Effect.gen(function* () {
        yield* Ref.update(exchanges, (values) => [
          ...values,
          { ...input, verifier: Redacted.value(input.verifier) },
        ]);
        if (options?.beforeExchange) yield* options.beforeExchange;
        return yield* credentials;
      }),
    refresh: (input) =>
      Effect.gen(function* () {
        yield* Ref.update(refreshes, (value) => value + 1);
        if (options?.beforeRefresh) yield* options.beforeRefresh;
        return { ...(yield* credentials), scopes: input.scopes };
      }),
    revoke: () => Ref.update(revocations, (value) => value + 1),
  });
  const broker = yield* buildLocalMcpOAuth({ urls, apiOrigin }).pipe(
    Effect.provideService(McpOAuthUpstream, upstream),
  );
  const client = yield* broker.register({
    client_name: "agent",
    redirect_uris: [agentRedirect],
    grant_types: ["authorization_code", "refresh_token"],
  });
  const authorization = {
    client_id: client.client_id,
    redirect_uri: agentRedirect,
    resource: urls.resource,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: "mcp:read mcp:execute offline_access",
    state: "agent-state",
  };
  const makeCode = Effect.gen(function* () {
    const redirect = new URL(yield* broker.begin(authorization));
    const callback = new URL(
      yield* broker.callback(redirect.searchParams.get("state") ?? "", "upstream-code"),
    );
    return {
      grant_type: "authorization_code",
      client_id: client.client_id,
      redirect_uri: agentRedirect,
      resource: urls.resource,
      code: callback.searchParams.get("code") ?? "",
      code_verifier: verifier,
    };
  });
  const login = Effect.flatMap(makeCode, broker.exchange);
  return { broker, client, authorization, makeCode, login, exchanges, refreshes, revocations };
});
