import { randomBytes, createHash, randomUUID } from "node:crypto";

import { Effect, Layer, Redacted, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

import { listenForAuthorization, openAuthorizationBrowser } from "./callback.js";
import { type McpCredential, type McpCredentialStore } from "./credential-store.js";
import {
  type LocalOAuthError,
  McpOAuthUpstream,
  type UpstreamCredentials,
} from "./oauth-contracts.js";
import { mcpOAuthUpstreamLayer } from "./oauth-upstream.js";

export interface McpOAuthProvider {
  register: (name: string) => Promise<string>;
  exchange: (clientId: string, code: string, verifier: string) => Promise<UpstreamCredentials>;
  refresh: (saved: McpCredential) => Promise<UpstreamCredentials>;
  revoke: (saved: McpCredential) => Promise<void>;
}

export const mcpOAuthProvider = (apiOrigin: string, callback: string): McpOAuthProvider => {
  const layer = mcpOAuthUpstreamLayer({ apiOrigin, callback }).pipe(
    Layer.provide(FetchHttpClient.layer),
  );
  const run = <A>(
    call: (provider: McpOAuthUpstream["Service"]) => Effect.Effect<A, LocalOAuthError>,
  ) => Effect.runPromise(Effect.flatMap(McpOAuthUpstream, call).pipe(Effect.provide(layer)));
  return {
    register: (name) => run((provider) => provider.register(name)),
    exchange: (clientId, code, verifier) =>
      run((provider) => provider.exchange({ clientId, code, verifier: Redacted.make(verifier) })),
    refresh: (saved) =>
      run((provider) =>
        provider.refresh({
          clientId: saved.clientId,
          refreshToken: Redacted.make(saved.refreshToken ?? ""),
          scopes: saved.scopes,
        }),
      ),
    revoke: (saved) =>
      run((provider) =>
        provider.revoke(saved.clientId, Redacted.make(saved.refreshToken ?? saved.accessToken)),
      ),
  };
};

const scopeSchema = Schema.Array(Schema.Literals(["mcp:read", "mcp:execute", "offline_access"]));
const ready = (generation: string, clientId: string, token: UpstreamCredentials): McpCredential => {
  const scopes = Schema.decodeUnknownSync(scopeSchema)(token.scopes);
  if (!scopes.includes("mcp:read")) throw new Error("MCP read permission was not granted.");
  return {
    version: 1,
    generation,
    phase: "ready",
    clientId,
    accessToken: Redacted.value(token.accessToken),
    refreshToken: token.refreshToken ? Redacted.value(token.refreshToken) : null,
    expiresAt: token.expiresAt,
    scopes,
  };
};
const signedOut = (): McpCredential => ({
  version: 1,
  generation: randomUUID(),
  phase: "signed-out",
  clientId: "",
  accessToken: "",
  refreshToken: null,
  expiresAt: 0,
  scopes: [],
});

export const createMcpSession = (config: {
  apiOrigin: string;
  profile: string;
  store: McpCredentialStore;
  provider?: (callback: string) => McpOAuthProvider;
  openBrowser?: (url: string) => Promise<void>;
  notify?: (message: string) => void;
  now?: () => number;
}) => {
  const { store } = config;
  const provider = config.provider ?? ((callback) => mcpOAuthProvider(config.apiOrigin, callback));
  const now = config.now ?? Date.now;
  const notify = config.notify ?? ((message) => process.stderr.write(`${message}\n`));
  let attempted = false;
  let pending: Promise<void> | undefined;
  const lifetime = new AbortController();

  const login = async () => {
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(5 * 60_000)]);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const generation = randomUUID();
    await store.lock(async () => {
      const previous = store.read();
      if (previous?.accessToken) await provider("").revoke(previous);
      store.write({ ...signedOut(), generation, phase: "authorizing" });
    });
    const callback = await listenForAuthorization(state, signal);
    try {
      const oauth = provider(callback.callback);
      const clientId = await oauth.register(config.profile);
      const url = new URL("/oauth/authorize", config.apiOrigin);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callback.callback,
        resource: config.apiOrigin,
        response_type: "code",
        code_challenge_method: "S256",
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
        scope: "mcp:read mcp:execute offline_access",
        state,
      }).toString();
      notify(`Authorize Namera (${config.profile}): ${url}`);
      try {
        await (config.openBrowser ?? openAuthorizationBrowser)(url.toString());
      } catch {
        notify("Could not open your browser. Open the URL above manually.");
      }
      const code = await callback.code;
      signal.throwIfAborted();
      const token = await oauth.exchange(clientId, code, verifier);
      const saved = ready(generation, clientId, token);
      try {
        await store.lock(async () => {
          if (signal.aborted || store.read()?.generation !== generation) {
            throw new Error("Authorization was cancelled or replaced.");
          }
          store.write(saved);
        });
      } catch (error) {
        await oauth.revoke(saved);
        throw error;
      }
      notify(`Namera MCP profile "${config.profile}" is connected.`);
    } finally {
      callback.close();
    }
  };

  const startLogin = () => {
    if (!pending) {
      attempted = true;
      pending = login().finally(() => {
        pending = undefined;
      });
    }
    return pending;
  };

  const credentials = () =>
    store.lock(async () => {
      const saved = store.read();
      if (saved?.phase !== "ready") return undefined;
      if (saved.expiresAt > now() + 30_000) return saved;
      if (!saved.refreshToken) return undefined;
      // Persist before consuming a rotating token. A crash or ambiguous failure
      // requires fresh consent instead of replaying the old refresh token.
      store.write({ ...saved, phase: "refreshing" });
      const token = await provider("").refresh(saved);
      if (
        token.scopes.some((scope) => !saved.scopes.includes(scope as (typeof saved.scopes)[number]))
      )
        throw new Error("Refreshed MCP permissions expanded unexpectedly.");
      const refreshed = ready(saved.generation, saved.clientId, token);
      store.write(refreshed);
      return refreshed;
    });

  return {
    login: startLogin,
    credentials,
    requestLogin: () => {
      if (!attempted)
        void startLogin().catch(() =>
          notify(
            `MCP login did not finish. Run namera mcp login --profile ${config.profile} --host ${config.apiOrigin}`,
          ),
        );
    },
    status: () => {
      const saved = store.read();
      return {
        profile: config.profile,
        apiOrigin: config.apiOrigin,
        status:
          saved?.phase === "ready"
            ? saved.expiresAt > now()
              ? "connected"
              : saved.refreshToken
                ? "refresh-required"
                : "login-required"
            : "login-required",
        scopes: saved?.phase === "ready" ? saved.scopes : [],
      };
    },
    logout: () =>
      store.lock(async () => {
        const saved = store.read();
        // Discard local authority even if remote revocation fails; retain no token
        // that another MCP process could continue to use after logout.
        store.write(signedOut());
        if (saved?.accessToken) await provider("").revoke(saved);
      }),
    close: () => lifetime.abort(),
  };
};
