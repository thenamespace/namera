import { Clock, Context, Crypto, Effect, Layer, Redacted, Schema } from "effect";

import {
  LocalOAuthAuthorization,
  LocalOAuthCodeExchange,
  LocalOAuthError,
  LocalOAuthRefresh,
  LocalOAuthRegistration,
  parseLocalOAuthScopes,
  McpOAuthUpstream,
  type UpstreamCredentials,
} from "./oauth-contracts.js";
import { matchesRegisteredRedirect, type LocalMcpUrls } from "./transport-security.js";

interface Client {
  readonly upstreamId: string;
  readonly redirects: readonly string[];
  readonly allowRefresh: boolean;
}

interface Pending {
  readonly client: Client;
  readonly request: typeof LocalOAuthAuthorization.Type;
  readonly scopes: readonly string[];
  readonly verifier: Redacted.Redacted<string>;
  readonly expiresAt: number;
}

interface AuthorizationCode extends Pending {
  readonly credentials: UpstreamCredentials;
}

interface Grant {
  readonly clientId: string;
  readonly upstreamId: string;
  readonly credentials: UpstreamCredentials;
  readonly scopes: readonly string[];
  readonly expiresAt: number;
  readonly refreshing?: boolean;
}

interface AccessToken {
  readonly grantId: string;
  readonly expiresAt: number;
}

const invalid = (code: LocalOAuthError["code"]) => new LocalOAuthError({ code });

export const buildLocalMcpOAuth = Effect.fn("LocalMcpOAuth.build")(function* (config: {
  readonly urls: LocalMcpUrls;
  readonly apiOrigin: string;
}) {
  const crypto = yield* Crypto.Crypto;
  const upstream = yield* McpOAuthUpstream;
  const clients = new Map<string, Client>();
  const pending = new Map<string, Pending>();
  const codes = new Map<string, AuthorizationCode>();
  const grants = new Map<string, Grant>();
  const access = new Map<string, AccessToken>();
  const refreshTokens = new Map<string, string>();

  const random = crypto
    .randomBytes(32)
    .pipe(Effect.map((bytes) => Buffer.from(bytes).toString("base64url")));
  const digest = Effect.fn("LocalMcpOAuth.digest")(function* (domain: string, value: string) {
    const bytes = yield* crypto.digest("SHA-256", Buffer.from(`${domain}${value}`));
    return Buffer.from(bytes).toString("base64url");
  });
  const removeGrant = (id: string) => {
    grants.delete(id);
    for (const [key, token] of access) if (token.grantId === id) access.delete(key);
    for (const [key, grantId] of refreshTokens) if (grantId === id) refreshTokens.delete(key);
  };
  const prune = (now: number) => {
    for (const [key, flow] of pending) if (flow.expiresAt <= now) pending.delete(key);
    for (const [key, code] of codes) if (code.expiresAt <= now) codes.delete(key);
    for (const [key, token] of access) if (token.expiresAt <= now) access.delete(key);
    for (const [key, grant] of grants) if (grant.expiresAt <= now) removeGrant(key);
  };

  const register = Effect.fn("LocalMcpOAuth.register")(function* (input: unknown) {
    const request = yield* Schema.decodeUnknownEffect(LocalOAuthRegistration)(input).pipe(
      Effect.mapError(() => invalid("invalid_request")),
    );
    if (clients.size >= 128) return yield* invalid("temporarily_unavailable");
    // Give each agent a distinct upstream public client and consent screen.
    const name = request.client_name ?? "MCP client";
    const grantTypes = request.grant_types ?? ["authorization_code"];
    const upstreamId = yield* upstream.register(name);
    const clientId = yield* random;
    if (clients.size >= 128) return yield* invalid("temporarily_unavailable");
    clients.set(clientId, {
      upstreamId,
      redirects: request.redirect_uris,
      allowRefresh: grantTypes.includes("refresh_token"),
    });
    return {
      client_id: clientId,
      client_name: name,
      redirect_uris: request.redirect_uris,
      token_endpoint_auth_method: "none" as const,
      grant_types: grantTypes,
      response_types: ["code"],
    };
  });

  const begin = Effect.fn("LocalMcpOAuth.begin")(function* (input: unknown) {
    const request = yield* Schema.decodeUnknownEffect(LocalOAuthAuthorization)(input).pipe(
      Effect.mapError(() => invalid("invalid_request")),
    );
    const client = clients.get(request.client_id);
    if (!client || !matchesRegisteredRedirect(client.redirects, request.redirect_uri))
      return yield* invalid("invalid_client");
    if (request.resource !== config.urls.resource) return yield* invalid("invalid_target");
    const scopes = parseLocalOAuthScopes(request.scope);
    if (!scopes || (scopes.includes("offline_access") && !client.allowRefresh))
      return yield* invalid("invalid_scope");
    const verifier = yield* random;
    const state = yield* random;
    const stateHash = yield* digest("state:", state);
    const challenge = yield* digest("", verifier);
    const now = yield* Clock.currentTimeMillis;
    prune(now);
    if (pending.size >= 128) return yield* invalid("temporarily_unavailable");
    pending.set(stateHash, {
      client,
      request,
      scopes,
      verifier: Redacted.make(verifier),
      expiresAt: now + 600_000,
    });
    const url = new URL("/oauth/authorize", config.apiOrigin);
    url.search = new URLSearchParams({
      client_id: client.upstreamId,
      redirect_uri: config.urls.callback,
      resource: config.apiOrigin,
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: scopes.join(" "),
      state,
    }).toString();
    return url.toString();
  });

  const callback = Effect.fn("LocalMcpOAuth.callback")(function* (
    state: string,
    upstreamCode: string,
  ) {
    const key = yield* digest("state:", state);
    const now = yield* Clock.currentTimeMillis;
    prune(now);
    const flow = pending.get(key);
    if (!flow) return yield* invalid("invalid_grant");
    // Consume before yielding to the provider; concurrent callbacks cannot exchange twice.
    pending.delete(key);
    const credentials = yield* upstream.exchange({
      clientId: flow.client.upstreamId,
      code: upstreamCode,
      verifier: flow.verifier,
    });
    const scopes = flow.scopes.filter((scope) => credentials.scopes.includes(scope));
    if (!scopes.includes("mcp:read")) return yield* invalid("invalid_scope");
    const code = yield* random;
    const codeHash = yield* digest("code:", code);
    const issuedAt = yield* Clock.currentTimeMillis;
    prune(issuedAt);
    if (flow.expiresAt <= issuedAt || credentials.expiresAt <= issuedAt)
      return yield* invalid("invalid_grant");
    if (codes.size >= 128) return yield* invalid("temporarily_unavailable");
    codes.set(codeHash, {
      ...flow,
      scopes,
      credentials,
      expiresAt: Math.min(flow.expiresAt, issuedAt + 60_000),
    });
    const redirect = new URL(flow.request.redirect_uri);
    redirect.searchParams.set("code", code);
    if (flow.request.state !== undefined) redirect.searchParams.set("state", flow.request.state);
    return redirect.toString();
  });

  const issue = Effect.fn("LocalMcpOAuth.issue")(function* (grant: Grant, replacingId?: string) {
    const token = yield* random;
    const tokenHash = yield* digest("access:", token);
    const refresh =
      grant.scopes.includes("offline_access") && grant.credentials.refreshToken
        ? yield* random
        : undefined;
    const refreshHash = refresh === undefined ? undefined : yield* digest("refresh:", refresh);
    const grantId = yield* random;
    const now = yield* Clock.currentTimeMillis;
    prune(now);
    const expiresAt = Math.min(now + 300_000, grant.credentials.expiresAt, grant.expiresAt);
    if (expiresAt - now < 1000) return yield* invalid("invalid_grant");
    // A revoke while the upstream refresh was in flight must win over issuance.
    if (replacingId !== undefined) {
      if (!grants.get(replacingId)?.refreshing) return yield* invalid("invalid_grant");
      removeGrant(replacingId);
    }
    if (grants.size >= 128) return yield* invalid("temporarily_unavailable");
    grants.set(grantId, {
      ...grant,
      refreshing: false,
      expiresAt: refresh === undefined ? expiresAt : grant.expiresAt,
    });
    access.set(tokenHash, { grantId, expiresAt });
    if (refreshHash !== undefined) refreshTokens.set(refreshHash, grantId);
    return {
      access_token: token,
      token_type: "Bearer" as const,
      expires_in: Math.floor((expiresAt - now) / 1000),
      scope: grant.scopes.join(" "),
      ...(refresh === undefined ? {} : { refresh_token: refresh }),
    };
  });

  const deny = Effect.fn("LocalMcpOAuth.deny")(function* (state: string) {
    const key = yield* digest("state:", state);
    prune(yield* Clock.currentTimeMillis);
    const flow = pending.get(key);
    if (!flow) return yield* invalid("invalid_grant");
    pending.delete(key);
    const redirect = new URL(flow.request.redirect_uri);
    redirect.searchParams.set("error", "access_denied");
    if (flow.request.state !== undefined) redirect.searchParams.set("state", flow.request.state);
    return redirect.toString();
  });

  const exchange = Effect.fn("LocalMcpOAuth.exchange")(function* (input: unknown) {
    const request = yield* Schema.decodeUnknownEffect(LocalOAuthCodeExchange)(input).pipe(
      Effect.mapError(() => invalid("invalid_request")),
    );
    const key = yield* digest("code:", request.code);
    const challenge = yield* digest("", request.code_verifier);
    const now = yield* Clock.currentTimeMillis;
    prune(now);
    const code = codes.get(key);
    if (!code) return yield* invalid("invalid_grant");
    codes.delete(key);
    if (
      request.client_id !== code.request.client_id ||
      request.redirect_uri !== code.request.redirect_uri ||
      request.resource !== config.urls.resource ||
      challenge !== code.request.code_challenge
    )
      return yield* invalid("invalid_grant");
    return yield* issue({
      clientId: request.client_id,
      upstreamId: code.client.upstreamId,
      credentials: code.credentials,
      scopes: code.scopes,
      expiresAt: now + 86_400_000,
    });
  });

  const refresh = Effect.fn("LocalMcpOAuth.refresh")(function* (input: unknown) {
    const request = yield* Schema.decodeUnknownEffect(LocalOAuthRefresh)(input).pipe(
      Effect.mapError(() => invalid("invalid_request")),
    );
    const key = yield* digest("refresh:", request.refresh_token);
    const now = yield* Clock.currentTimeMillis;
    prune(now);
    const id = refreshTokens.get(key);
    const grant = id === undefined ? undefined : grants.get(id);
    if (
      !grant ||
      !id ||
      grant.refreshing ||
      grant.clientId !== request.client_id ||
      request.resource !== config.urls.resource ||
      !grant.credentials.refreshToken
    )
      return yield* invalid("invalid_grant");
    const scopes =
      request.scope === undefined ? grant.scopes : parseLocalOAuthScopes(request.scope);
    if (!scopes || scopes.some((scope) => !grant.scopes.includes(scope)))
      return yield* invalid("invalid_scope");
    // Freeze the family before rotating upstream, while keeping it revocable.
    // Ambiguous failures require fresh consent, not reuse of a consumed token.
    grants.set(id, { ...grant, refreshing: true });
    const credentials = yield* upstream.refresh({
      clientId: grant.upstreamId,
      refreshToken: grant.credentials.refreshToken,
      scopes,
    });
    const effective = scopes.filter((scope) => credentials.scopes.includes(scope));
    if (!effective.includes("mcp:read")) return yield* invalid("invalid_scope");
    return yield* issue({ ...grant, credentials, scopes: effective }, id);
  });

  const authenticate = Effect.fn("LocalMcpOAuth.authenticate")(function* (token: string) {
    const key = yield* digest("access:", token);
    const now = yield* Clock.currentTimeMillis;
    prune(now);
    const local = access.get(key);
    const grant = local === undefined ? undefined : grants.get(local.grantId);
    if (!grant || grant.refreshing || grant.credentials.expiresAt <= now)
      return yield* invalid("invalid_token");
    // The transport must also load the live API actor before dispatching a tool.
    return {
      accessToken: grant.credentials.accessToken,
      scopes: grant.scopes,
      clientId: grant.clientId,
    };
  });

  const revoke = Effect.fn("LocalMcpOAuth.revoke")(function* (clientId: string, token: string) {
    const accessHash = yield* digest("access:", token);
    const refreshHash = yield* digest("refresh:", token);
    const id = access.get(accessHash)?.grantId ?? refreshTokens.get(refreshHash);
    const grant = id === undefined ? undefined : grants.get(id);
    if (!grant || !id || grant.clientId !== clientId) return;
    removeGrant(id);
    yield* upstream.revoke(
      grant.upstreamId,
      grant.credentials.refreshToken ?? grant.credentials.accessToken,
    );
  });

  return { register, begin, callback, deny, exchange, refresh, authenticate, revoke };
});

export class LocalMcpOAuth extends Context.Service<
  LocalMcpOAuth,
  Effect.Success<ReturnType<typeof buildLocalMcpOAuth>>
>()("@namera-ai/cli/LocalMcpOAuth") {
  static layer(config: Parameters<typeof buildLocalMcpOAuth>[0]) {
    return Layer.effect(LocalMcpOAuth, buildLocalMcpOAuth(config));
  }
}
