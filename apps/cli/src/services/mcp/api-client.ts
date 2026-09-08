import { Context, Effect, Layer, Redacted } from "effect";

import type { McpActor } from "@namera-ai/protocol/dto";
import { NameraClient, type NameraFetch, type ResolveSessionSigner } from "@namera-ai/sdk";

import { LocalOAuthError } from "./oauth-contracts.js";

export interface LocalMcpPrincipal {
  readonly client: NameraClient;
  readonly actor: McpActor;
  readonly localClientId: string;
  readonly scopes: readonly string[];
}

export const CurrentLocalMcpPrincipal = Context.Reference<LocalMcpPrincipal | null>(
  "@namera-ai/cli/CurrentLocalMcpPrincipal",
  { defaultValue: () => null },
);

export const makeMcpApiClient = Effect.fn("LocalMcpApi.authenticate")(function* (
  config: {
    readonly apiOrigin: string;
    readonly fetch?: NameraFetch;
    readonly resolveSessionSigner?: ResolveSessionSigner;
  },
  authorization: {
    readonly accessToken: Redacted.Redacted<string>;
    readonly clientId: string;
    readonly scopes: readonly string[];
  },
) {
  const resolveSigner = config.resolveSessionSigner;
  const client = new NameraClient({
    baseUrl: config.apiOrigin,
    accessToken: Redacted.value(authorization.accessToken),
    fetch: (input, init) => {
      const timeout = AbortSignal.timeout(30_000);
      return (config.fetch ?? globalThis.fetch)(input, {
        ...init,
        redirect: "error",
        signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      });
    },
    ...(resolveSigner === undefined
      ? {}
      : {
          resolveSessionSigner: async (request) => {
            // Resolve no key material until the API has confirmed this exact grant.
            const permitted = actor.data.grants.some(
              ({ sessionKey }) =>
                sessionKey.id === request.sessionKeyId &&
                sessionKey.walletId === request.walletId &&
                sessionKey.namespace === request.namespace &&
                sessionKey.status === "active",
            );
            if (!permitted) throw new Error("The selected session is not authorized.");
            return resolveSigner(request);
          },
        }),
  });
  const result = yield* Effect.tryPromise({
    try: () => client.auth.currentActor(),
    catch: () => new LocalOAuthError({ code: "temporarily_unavailable" }),
  });
  if (!result.success)
    return yield* new LocalOAuthError({
      code:
        result.error.status === 401 ||
        result.error.status === 403 ||
        (result.error.kind === "api" &&
          (result.error.tag === "Unauthorized" || result.error.tag === "Forbidden"))
          ? "invalid_token"
          : "temporarily_unavailable",
    });
  if (result.data.type !== "mcp") return yield* new LocalOAuthError({ code: "invalid_token" });
  const actor = result.data;
  const scopes = authorization.scopes.filter((scope) =>
    actor.data.authorization.scopes.some((allowed) => allowed === scope),
  );
  if (!scopes.includes("mcp:read")) return yield* new LocalOAuthError({ code: "invalid_token" });
  return {
    client,
    actor,
    scopes,
    localClientId: authorization.clientId,
  } satisfies LocalMcpPrincipal;
});

export class LocalMcpApi extends Context.Service<
  LocalMcpApi,
  {
    readonly authenticate: (
      authorization: Parameters<typeof makeMcpApiClient>[1],
    ) => ReturnType<typeof makeMcpApiClient>;
  }
>()("@namera-ai/cli/LocalMcpApi") {
  static layer(config: Parameters<typeof makeMcpApiClient>[0]) {
    return Layer.succeed(LocalMcpApi, {
      authenticate: (authorization) => makeMcpApiClient(config, authorization),
    });
  }
}
