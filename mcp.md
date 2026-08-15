# MCP server and authorization design

This document describes the authorized Model Context Protocol server integrated
into the existing Namera HTTP server and records the remaining implementation
work.

```text
MCP resource:       https://api.namera.ai/mcp
OAuth issuer:       https://api.namera.ai
Dashboard consent:  https://dashboard.namera.ai/oauth/authorize?requestId=...
```

The MCP resource server, OAuth authorization server, API routes, workers, and
application services can all run in the existing `apps/server` process. They
should remain separate logical layers even though they share one deployment,
database, hostname, and Effect runtime.

## Implementation status

The OAuth authorization-server slice is implemented. It includes RFC discovery
metadata, pre-registered public clients, authorization-code + PKCE `S256`,
rotating refresh tokens with reuse invalidation, token revocation, authenticated
consent APIs, durable organization-scoped `mcp` actors and session-key grants,
management reads/revocation, rate limits, bounded telemetry, organization audit
events, in-app notifications, and server boundary tests. OAuth authorization
does not send email.

Bearer-token authentication and the Effect Streamable HTTP transport are mounted
at `/mcp` using Effect's available `2025-06-18` protocol adapter. The initial
read-only tool lists the active session-key grants delegated to the current MCP
authorization. Client ID Metadata Documents and dynamic registration remain
deferred and discovery does not advertise those unsupported capabilities.

Here, “MCP 2.1 authorization” means MCP authorization built on OAuth 2.1; MCP
itself uses date-based protocol revisions rather than a `2.1` version number.
OAuth grants delegated access and does not replace Namera login. The existing
magic-link session authenticates the resource owner during consent, so Namera
does not need OpenID Connect, ID tokens, or a UserInfo endpoint for this flow.

## Recommendation

Implement Namera as all three of these roles:

- `apps/server` is the OAuth 2.1 authorization server.
- `POST /mcp` is the protected MCP resource server.
- An MCP host such as Claude, Cursor, or a custom agent is the OAuth client.

Use the authorization-code grant with PKCE `S256`. Start with public clients,
opaque access and refresh tokens, short-lived access tokens, rotating refresh
tokens, exact resource binding to `https://api.namera.ai/mcp`, and no client
credentials, implicit, or password grant.

An OAuth client is not a Namera actor. A client identifies software, while an
actor identifies a tenant-scoped principal that can receive Namera grants.
Create one `mcp` actor for each approved MCP authorization. Attach the selected
session keys to that actor through the existing `session_key_grant` table.

```text
OAuth client
    |
    | user approves access for one organization
    v
MCP authorization ---- owns ----> auth.actor(type = "mcp")
                                      |
                                      v
                             session_key_grant
                                      |
                                      v
                                session_key
```

This gives API keys and MCP authorizations the same execution boundary:

```text
authenticate credential
  -> resolve actor
  -> load actor's session-key grants
  -> select the requested wallet
  -> require one granted session key to approve the complete operation
  -> reserve policy state
  -> execute
  -> settle or release policy state
```

OAuth scopes should remain coarse transport capabilities. Session-key grants
and policies remain the fine-grained wallet authorization model.

## Current specification and Effect compatibility

As of 15 August 2026, the current MCP revision is `2026-07-28`. Its Streamable
HTTP transport uses one POST per JSON-RPC request, has no standalone GET stream,
and has no protocol-level session. Every POST carries protocol metadata and the
required mirrored HTTP headers.

The repository currently uses Effect `4.0.0-beta.105`. Its built-in MCP module
is available from `effect/unstable/ai`, but its only protocol adapter is
`McpProtocol.v2025_06_18`. Its `McpServer.layerHttp` implementation therefore
uses the older stateful transport with `Mcp-Session-Id`.

Do not claim that the current Effect adapter implements MCP `2026-07-28`.
Choose one explicit compatibility target when implementation starts:

1. Preferred: upgrade Effect when it exposes a `2026-07-28` adapter, then use
   that adapter directly.
2. Practical interim: ship Effect's `2025-06-18` adapter and test it against the
   actual MCP hosts Namera supports. Modern clients are required to implement
   backward-compatibility negotiation, but interoperability must still be
   verified.
3. If current-revision support is required before Effect adds it, wrap the
   official MCP TypeScript SDK transport at the HTTP edge while keeping OAuth,
   actors, grants, tools, and application workflows in Effect. Do not implement
   the new wire protocol by hand.

The OAuth design below is independent of the MCP transport revision, so it can
be implemented first without creating a migration problem.

## Required public endpoints

### MCP resource server

```text
POST /mcp
```

For MCP `2026-07-28`, all JSON-RPC traffic uses POST. GET, PUT, PATCH, DELETE,
and unsupported methods return `405 Method Not Allowed`. The endpoint must:

- validate `Origin` whenever it is present and return `403` for an untrusted
  origin;
- require `Authorization: Bearer <token>` on every request;
- reject tokens in query parameters;
- validate that the token is active, unexpired, has sufficient scope, and is
  bound to the exact MCP resource URI;
- return `401` for a missing, invalid, expired, or revoked token;
- return `403` with `error="insufficient_scope"` for a valid token missing a
  required scope;
- apply a per-authorization rate limit in addition to the global rate limit;
- never accept the dashboard `auth-token` cookie as MCP authentication.

The initial challenge should be similar to:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://api.namera.ai/.well-known/oauth-protected-resource/mcp", scope="mcp:read mcp:execute"
```

### Discovery metadata

Serve RFC 9728 protected resource metadata at:

```text
GET /.well-known/oauth-protected-resource/mcp
```

```json
{
  "resource": "https://api.namera.ai/mcp",
  "authorization_servers": ["https://api.namera.ai"],
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["mcp:read", "mcp:execute"]
}
```

The resource is canonical configuration, not a value assembled from an
untrusted request host. Always use the exact URI without a trailing slash.

Serve RFC 8414 authorization server metadata at:

```text
GET /.well-known/oauth-authorization-server
```

```json
{
  "issuer": "https://api.namera.ai",
  "authorization_endpoint": "https://api.namera.ai/oauth/authorize",
  "token_endpoint": "https://api.namera.ai/oauth/token",
  "revocation_endpoint": "https://api.namera.ai/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["none"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:read", "mcp:execute", "offline_access"]
}
```

Add `registration_endpoint` only if Namera implements the deprecated dynamic
client registration fallback.

### OAuth protocol and management endpoints

```text
GET  /oauth/authorize
POST /oauth/token
POST /oauth/revoke
POST /oauth/register   optional compatibility fallback
```

OAuth token and registration endpoints use their standard media types rather
than the normal Namera JSON API conventions. Keep them as focused raw
`HttpRouter` routes. Browser-facing dashboard APIs can remain Effect `HttpApi`:

```text
GET  /oauth/authorization-requests/:requestId
POST /oauth/authorization-requests/approve
POST /oauth/authorization-requests/deny
GET  /oauth/authorizations
GET  /oauth/authorizations/:authorizationId
POST /oauth/authorizations/revoke
```

The last two are Namera management APIs, not OAuth protocol endpoints. They
require a user actor and organization permissions.

## Client registration

The current MCP specification gives this priority:

1. pre-registered client;
2. OAuth Client ID Metadata Document;
3. Dynamic Client Registration as a deprecated compatibility fallback.

Namera should support pre-registration and Client ID Metadata Documents first.
With metadata documents, `client_id` is an HTTPS URL with a path. Namera fetches
the document, verifies that its `client_id` exactly equals that URL, and exact-
matches the requested redirect URI against `redirect_uris`.

Fetching a client metadata URL is an SSRF boundary. The resolver must enforce:

- HTTPS metadata URLs with a path;
- bounded response size and timeout;
- JSON content and schema validation;
- no credentials in URLs;
- no private, loopback, link-local, multicast, or metadata-service addresses;
- safe redirect handling and DNS rebinding protection;
- cache behavior that respects HTTP cache headers;
- exact `client_id` and redirect URI comparison.

Localhost may appear in a native client's redirect URI, but it must not be
accepted as a Client ID Metadata Document URL. Clearly display the redirect
hostname on the consent screen, especially for localhost callbacks.

Dynamic Client Registration can be added after testing Claude, Cursor, and the
other target hosts. If added, accept public clients only at first:

```text
token_endpoint_auth_method = "none"
grant_types               = ["authorization_code", "refresh_token"]
response_types            = ["code"]
```

Do not issue a client secret to a desktop, CLI, browser, or other public client.
A secret embedded in one of those applications is not confidential.

## Authorization and consent flow

### 1. MCP discovery

1. The MCP client calls `POST /mcp` without a token.
2. Namera returns `401` with `resource_metadata` and required scopes.
3. The client fetches protected resource metadata.
4. The client fetches authorization server metadata from the advertised issuer.
5. The client resolves its registration through pre-registration, a Client ID
   Metadata Document, or the optional registration endpoint.

### 2. Authorization request

The client navigates the user agent to `/oauth/authorize` with at least:

```text
response_type=code
client_id=...
redirect_uri=...
code_challenge=...
code_challenge_method=S256
resource=https://api.namera.ai/mcp
scope=mcp:read mcp:execute
state=...
```

The authorization endpoint validates the client and redirect URI before it
redirects anywhere. It creates a short-lived authorization-request row and
redirects the browser to:

```text
https://dashboard.namera.ai/authorizations/:requestId
```

If the user is not signed in, the dashboard uses the existing magic-link flow
and preserves this dashboard-relative return path. OAuth request state stays in
the database; it must not be copied through login query parameters.

### 3. Consent

The consent page obtains the request through the authenticated Namera API and
shows:

- verified client name and logo;
- exact client and redirect hostnames;
- requested coarse OAuth scopes;
- selected organization;
- wallets and session keys being delegated;
- authorization expiry, when configured;
- an explicit approve or deny action.

The approving user needs an organization permission such as
`mcp-authorization:create` and must be allowed to grant every selected session
key. Do not infer consent from login and do not preselect every session key.

Approval runs in one transaction:

1. lock and revalidate the pending authorization request;
2. create an `auth.actor` with type `mcp` for the organization;
3. create the durable MCP authorization linked to that actor;
4. create `session_key_grant` rows for the selected session keys;
5. create a short-lived, one-time authorization code whose raw value is
   returned only once and whose hash is stored;
6. write the organization audit event;
7. mark the authorization request approved.

The dashboard then navigates to the validated callback URI with `code`, the
original `state`, and `iss=https://api.namera.ai`. Denial returns the standard
OAuth error while preserving `state` and `iss`.

### 4. Token exchange

`POST /oauth/token` accepts form-encoded authorization-code requests. In one
transaction it must:

1. hash and locate the code;
2. atomically consume it;
3. verify expiry, client, redirect URI, resource, and authorization status;
4. verify the PKCE code verifier against the stored S256 challenge;
5. issue an opaque access token and, when allowed, a refresh token;
6. store only credential hashes;
7. return raw tokens once with `Cache-Control: no-store` and `Pragma: no-cache`.

Recommended starting lifetimes:

```text
authorization request: 10 minutes
authorization code:     5 minutes
access token:           15 minutes
refresh token:          30 days
```

Access-token issuance does not copy the complete session-key grant set into the
token. The token resolves the durable MCP authorization and actor, so revocation
or grant changes take effect immediately.

### 5. Refresh and revocation

Public clients require refresh-token rotation. Each successful refresh consumes
the old refresh token, issues a new token in the same family, and issues a new
access token. Reuse of an already-consumed refresh token revokes its entire
family and active access tokens issued from it.

Revoking an MCP authorization must atomically:

- mark the authorization revoked;
- revoke its active access and refresh tokens;
- remove or deactivate its `session_key_grant` rows;
- preserve the actor and authorization rows for audit identity;
- write an organization audit event.

Session-key revocation must make affected authorizations unusable for that key
without waiting for token expiry.

## Data model

Place shared schemas under `packages/protocol/src/model/auth/oauth/` and Drizzle
tables under `packages/database/src/schema/auth/oauth/`. Follow the existing
project convention: discriminator/status columns are PostgreSQL `text` with
`.$type<...>()`, not PostgreSQL enums. Public OAuth DTOs must not expose hashes.

Use the project's timestamp fields, branded IDs where identity confusion would
matter, metadata conventions, composite organization foreign keys, and UUID
helper. These field lists describe domain shape rather than exact Drizzle code.

### `auth.oauth_client`

Represents client software, not a tenant principal.

```text
id
clientId                    unique; URL for metadata-document clients
registrationType            metadata-document | pre-registered | dynamic
clientName
clientUri                   nullable
logoUri                     nullable
redirectUris                readonly string[]
grantTypes                  readonly string[]
responseTypes               readonly string[]
tokenEndpointAuthMethod     initially none
metadata                    JSON
status                      active | disabled
metadataExpiresAt           nullable; cached CIMD data
createdAt
updatedAt
```

For a Client ID Metadata Document, treat this as a validated cache/snapshot and
revalidate according to HTTP cache policy. For DCR or pre-registration, it is
the source of truth. A future confidential-client secret is stored as a hash.

Use a unique constraint on `clientId`. Exact redirect URI membership is checked
in application logic against the decoded readonly array.

### `auth.oauth_authorization_request`

Short-lived server-side state that survives magic-link login and dashboard
navigation.

```text
id
clientId                    FK to oauth_client
userId                      nullable until authenticated
organizationId             nullable until selected
redirectUri
responseType                code
codeChallenge
codeChallengeMethod         S256
resource                    exact canonical MCP URI
requestedScopes             readonly scope[]
state                       nullable opaque client value
status                      pending | approved | denied | expired
expiresAt
approvedAt                  nullable
deniedAt                    nullable
createdAt
updatedAt
```

Do not put the authorization code in this row. Never log `state` or the PKCE
challenge. Index `(status, expiresAt)` for cleanup and `userId` for consent
lookup after login.

### `auth.mcp_authorization`

The durable user consent and Namera authorization boundary.

```text
id
organizationId
actorId                     auth.actor(type = mcp)
clientId                    FK to oauth_client
authorizedByActorId         approving user actor
scopes                      readonly scope[]
resource                    exact canonical MCP URI
status                      active | revoked
expiresAt                   nullable
lastUsedAt                  nullable
revokedAt                   nullable
revokedByActorId            nullable
metadata
createdAt
updatedAt
```

Add composite tenant foreign keys for the MCP, authorizing, and revoking actors
where applicable. Index `(organizationId, status)`, `(clientId, status)`, and
`expiresAt`; make `actorId` unique because one actor represents one durable
authorization.

Do not make `(clientId, organizationId)` unique. The same client may be
authorized more than once with different session-key grants or lifetimes.

### `auth.oauth_authorization_code`

One-time credential for the code exchange.

```text
id
authorizationId             FK to mcp_authorization
clientId                    FK to oauth_client
codeHash                    unique
redirectUri
codeChallenge
codeChallengeMethod         S256
resource
scopes                      readonly scope[]
expiresAt
consumedAt                  nullable
createdAt
```

Use a cryptographically random high-entropy code, store only its domain-
separated HMAC/hash, and consume it with an atomic conditional update. Index
`expiresAt` for cleanup.

### `auth.oauth_token`

A single credential table is sufficient for opaque access and refresh tokens.

```text
id
authorizationId             FK to mcp_authorization
clientId                    FK to oauth_client
type                        access | refresh
tokenHash                   unique
familyId                    nullable; required for refresh tokens
parentId                    nullable; previous refresh token
resource
scopes                      readonly scope[]
expiresAt
consumedAt                  nullable; refresh rotation
revokedAt                   nullable
lastUsedAt                  nullable
createdAt
```

Only refresh rows use `familyId`, `parentId`, and `consumedAt`. Access-token
lookup is a unique hash lookup followed by authorization, expiry, resource, and
scope checks. Add indexes for `(authorizationId, type, revokedAt)`, `familyId`,
and `expiresAt` in addition to the unique token hash.

If the nullable lifecycle fields make repository logic unclear, split this into
`oauth_access_token` and `oauth_refresh_token`; the security model remains the
same. Do not use JWTs merely to avoid this lookup. In one server and database,
opaque tokens make immediate revocation and tenant checks simpler and avoid a
signing-key/JWKS subsystem.

### Existing table changes

Extend `auth.actor.type` with `mcp`. `core.session_key_grant` needs no structural
change: it already attaches an actor to selected session keys.

Add an MCP actor response to the internal actor union only where needed. Do not
allow a bearer MCP token through the current cookie-based REST authorization
middleware by accident. Use a separate `McpPrincipal` request service.

No MCP transport-session table is needed for MCP `2026-07-28`; protocol-level
sessions were removed. If the interim Effect `2025-06-18` adapter is used, its
in-memory session behavior is transport compatibility state, not durable domain
authorization. Do not model it as an OAuth or Namera session.

## Scope and grant model

Use a small initial scope vocabulary:

```text
mcp:read       list wallets and session keys visible to this authorization
mcp:execute    execute operations through granted session keys
offline_access request eligibility for a refresh token
```

`offline_access` belongs only in authorization-server metadata. It should not
appear in the MCP resource's challenge because refresh-token issuance is not a
resource requirement.

Do not encode wallet IDs, contract policies, spend limits, or session-key IDs as
OAuth scopes. Those are Namera grants and policies. This prevents scope
explosion and keeps the policy engine reusable by API keys, MCP, CLI
authorization, and future actor types.

Both coarse and fine-grained checks apply:

```text
OAuth scope allows the MCP tool category
AND
MCP actor has a grant to a session key for the requested wallet
AND
one granted session key's policies approve the entire operation
```

## Effect integration in the existing server

### Package ownership

Use the existing package boundaries:

```text
packages/protocol
  OAuth/MCP models, DTOs, identifiers, scopes, and typed expected errors

packages/database
  OAuth tables, relations, cleanup queries, and focused repositories

packages/application
  request, consent, token, refresh, revoke, and management workflows;
  actor/grant transactions; audit events; metrics

packages/api
  authenticated dashboard management contracts only

apps/server
  RFC metadata, OAuth wire endpoints, MCP bearer middleware, MCP tools,
  Streamable HTTP mounting, redirects, cookies, and rate limiting
```

Do not put JSON-RPC transport definitions into `packages/api`; that package
describes the Namera HTTP API. MCP tool handlers are transport adapters in the
server and call `Application` operations. Business logic remains in
`packages/application`.

Suggested server structure:

```text
apps/server/src/
  mcp/
    layer.ts
    principal.ts
    authorization.ts
    tools/
      index.ts
      accounts.ts
      session-keys.ts
      execution.ts
  oauth/
    metadata.ts
    authorize.ts
    token.ts
    revoke.ts
    register.ts
    layer.ts
```

### MCP layer

With the currently installed Effect API, the integration shape is approximately:

```ts
import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/unstable/ai";

const McpTransport = McpServer.layerHttp({
  name: "Namera",
  version: "1.0.0",
  path: "/mcp",
  protocols: [McpProtocol.v2025_06_18],
  allowedOrigins: [],
});

const McpTools = Layer.mergeAll(AccountTools, SessionKeyTools, ExecutionTools);

export const McpRoutes = McpTools.pipe(Layer.provide(McpTransport), Layer.provide(ServicesLive));
```

Treat this as the integration shape, not final copy-paste code. Recheck the
installed source when implementing because the API is under
`effect/unstable/ai`, and replace the adapter when Effect supports the selected
MCP revision.

`McpServer.layerHttp` registers its path in `HttpRouter`, so merge the result
into the existing `Routes` layer in `apps/server/src/layers/server.ts`. It does
not require a second listener or process.

Protect only this layer with MCP bearer middleware, using the same scoped router
composition pattern already used for RPC and telemetry routes. The middleware:

1. validates Origin;
2. parses the Authorization header;
3. hashes and loads the opaque access token;
4. validates expiry, revocation, scope, authorization status, resource, and
   organization integrity;
5. loads the MCP actor;
6. provides `McpPrincipal` to the request effect;
7. updates `lastUsedAt` at a throttled cadence rather than on every request.

```ts
export class McpPrincipal extends Context.Service<
  McpPrincipal,
  {
    readonly authorizationId: McpAuthorizationId;
    readonly actorId: ActorId;
    readonly organizationId: OrganizationId;
    readonly clientId: OAuthClientId;
    readonly scopes: ReadonlySet<McpScope>;
  }
>()("@namera-ai/server/McpPrincipal") {}
```

Verify with an integration test that the service provided by HTTP middleware is
visible inside Effect MCP tool handlers. If the older Effect RPC transport
breaks request context propagation, bridge only this principal through a scoped
FiberRef/middleware service; never use a module-global variable.

### Tool definitions

Use Effect `Toolkit` plus `McpServer.toolkit`/`registerToolkit` so inputs and
outputs remain schema-typed. Keep the first tool surface small:

```text
list_accounts
list_session_keys
execute_transaction
```

Tools must not accept `organizationId`, `actorId`, or arbitrary grant IDs from
the model. Those come from `McpPrincipal`. A wallet ID or address is an operation
target, not an authorization claim; application logic still verifies a grant.

Tool handlers follow the same server rule as REST routes:

```text
read McpPrincipal
  -> check coarse scope
  -> call Application
  -> map typed expected failures to safe MCP tool results
```

Never return raw Effect causes, stack traces, provider errors, tokens, hidden
policy state, or key material. Tool descriptions must distinguish reading data
from executing transactions. Mark annotations accurately: listing tools are
read-only; transaction execution is destructive and not generally idempotent.

## Application services and repositories

Focused repository operations are sufficient:

```text
OAuthClientRepository
  findByClientId
  upsertMetadataSnapshot
  insertDynamic

OAuthAuthorizationRequestRepository
  insert
  findPendingById
  approve
  deny

McpAuthorizationRepository
  insert
  findActiveById
  listForOrganization
  revoke

OAuthAuthorizationCodeRepository
  insert
  consumeByHash

OAuthTokenRepository
  insertAccess
  insertRefresh
  findActiveAccessByHash
  consumeRefreshByHash
  revokeAuthorization
  revokeFamily
```

All methods use the existing database/transaction context. Code consumption,
consent approval, refresh rotation, and revocation are explicit transaction
boundaries.

Expose workflows under the existing aggregate application service:

```text
application.oauth.client.resolve
application.oauth.authorization.request
application.oauth.authorization.getConsent
application.oauth.authorization.approve
application.oauth.authorization.deny
application.oauth.token.exchange
application.oauth.token.refresh
application.oauth.token.revoke
application.mcp.authorization.list
application.mcp.authorization.revoke
```

Credential generation and hashing reuse `packages/crypto`. Use separate domain
labels for authorization codes, access tokens, and refresh tokens so the same
raw value cannot authenticate as another credential type.

## Authorization rules

Add member permissions only when the corresponding route exists:

```text
mcp-authorization:create
mcp-authorization:read
mcp-authorization:revoke
```

Existing session-key permissions still govern whether a user may delegate a
selected key. Approval rejects cross-organization session keys even if a
malformed request reaches application logic.

An active access token is necessary but not sufficient. Every tool call checks
the current durable authorization and grants. This handles:

- user membership removal;
- role or permission changes;
- organization suspension in the future;
- session-key revocation or expiry;
- MCP authorization revocation;
- wallet status changes.

Decide one explicit rule for membership removal. The safer default is to revoke
all MCP authorizations approved through that membership when it is removed.

## Security requirements

- Use HTTPS for every production OAuth and MCP endpoint.
- Require PKCE `S256`; reject `plain` and missing challenges.
- Exact-match registered redirect URIs. Do not allow wildcards.
- Permit native loopback callbacks according to native-app rules; never treat
  arbitrary localhost metadata URLs as trusted.
- Include `iss` in successful and error authorization responses and advertise
  support in metadata.
- Require `resource=https://api.namera.ai/mcp` in authorization and token
  requests. Bind every token to it and validate it on `/mcp`.
- Store hashes of codes and tokens. Return raw credentials once.
- Use constant-time credential comparison through the shared crypto service.
- Rotate refresh tokens and revoke a family on reuse.
- Send bearer tokens only in the Authorization header.
- Set `Cache-Control: no-store` on authorization, consent, and token responses
  containing sensitive state.
- Redact Authorization, code, verifier, token, state, and client metadata fetch
  URLs from logs and traces.
- Validate Origin on `/mcp` independently of ordinary browser CORS.
- Apply CSRF protection to dashboard consent mutations. OAuth `state` protects
  the client callback; it does not protect Namera's approval form.
- Apply clickjacking protection to the consent UI.
- Never pass the MCP bearer token to Alchemy, Pimlico, or another upstream.
- Keep client metadata fetching behind an SSRF-safe HTTP client.
- Rate-limit discovery lightly; rate-limit authorize, token, registration, and
  failed bearer validation more strictly.
- Bound request sizes and the number of session keys selected in one consent.

## Audit, notifications, and telemetry

Organization audit events:

```text
mcp-authorization.created
mcp-authorization.revoked
mcp-authorization.refresh-token-reuse-detected
```

Store client ID/name, authorization ID, actor ID, coarse scopes, and selected
session-key IDs where useful. Never store raw codes, tokens, verifier, state, or
Authorization headers in audit data.

User security notifications are appropriate for a new MCP authorization and
refresh-token reuse detection. Routine token refresh and individual MCP calls
should not send notifications.

Use lowercase span names consistent with repository telemetry guidance:

```text
oauth.client.resolve
oauth.authorization.request
oauth.authorization.approve
oauth.token.exchange
oauth.token.refresh
oauth.token.revoke
mcp.authenticate
mcp.request
mcp.tool.list-accounts
mcp.tool.list-session-keys
mcp.tool.execute-transaction
```

Useful bounded metrics:

```text
oauth_authorization_requests_total{result}
oauth_token_exchanges_total{grant_type,result}
oauth_refresh_reuse_total
mcp_requests_total{method,result}
mcp_tool_calls_total{tool,result}
mcp_tool_duration_ms{tool,result}
```

Do not use client IDs, actor IDs, organization IDs, wallet IDs, token hashes,
addresses, or arbitrary tool arguments as metric attributes.

## Cleanup and operations

Run a small scheduled cleanup fiber/worker in the existing server runtime to
delete or archive:

- expired authorization requests;
- expired, consumed authorization codes;
- expired access tokens;
- old consumed/revoked refresh tokens after the security retention window;
- expired cached client metadata.

The feature does not need a separate queue or server for correctness. If Namera
later runs multiple replicas, PostgreSQL remains the source of truth for codes,
tokens, authorizations, grants, and refresh rotation. Do not rely on process
memory for credential correctness or revocation.

## Test plan

Add boundary tests in `apps/server/tests`, using the real application and test
database layers.

### Discovery and transport

- protected resource metadata uses the exact MCP resource and issuer;
- authorization metadata advertises PKCE S256 and supported grants;
- unauthenticated `/mcp` returns the correct challenge;
- invalid Origin returns `403`;
- unsupported HTTP methods return `405`;
- unsupported MCP versions and malformed JSON-RPC produce the correct response;
- an authenticated tool call sees the correct `McpPrincipal`.

### Authorization

- missing or non-S256 PKCE is rejected;
- mismatched resource is rejected at authorize and token endpoints;
- unregistered or mismatched redirect URI is never redirected to;
- expired authorization requests cannot be approved;
- login preserves the consent request;
- cross-organization session keys cannot be granted;
- a user without delegation permission cannot approve;
- approval creates actor, authorization, grants, code, and audit event in one
  transaction;
- denial preserves `state` and includes the issuer.

### Credentials

- authorization codes are single-use and short-lived;
- incorrect verifier, client, redirect URI, or resource cannot redeem a code;
- raw credentials never appear in database rows;
- access tokens reject expiry, revocation, wrong resource, and insufficient
  scope;
- refresh rotates the token and old-token reuse revokes the family;
- revocation takes effect on the next MCP request;
- removing a session-key grant immediately removes tool authority.

### Tools

- list tools return only data visible through the MCP authorization;
- organization and actor IDs cannot be supplied by tool input;
- transaction execution requires `mcp:execute`;
- all calls in one operation must pass one granted session key;
- policy reservation settles on success and releases on failure;
- expected failures are safe MCP results and defects do not leak internals.

## Implementation order

1. Add protocol identifiers, scopes, models, DTOs, and errors.
2. Add the five OAuth tables, actor type, relations, migrations, and
   repositories.
3. Implement client resolution with SSRF protection.
4. Implement discovery metadata and authorization-request creation.
5. Add authenticated dashboard consent APIs and UI.
6. Implement code exchange, opaque access tokens, refresh rotation, and
   revocation.
7. Add `McpPrincipal` middleware and `/mcp` with one read-only tool.
8. Verify the chosen Effect/MCP revision against target clients.
9. Add session-key listing and transaction execution tools.
10. Add audit events, notifications, metrics, cleanup, and boundary tests as
    each corresponding workflow is introduced.

Do not start with transaction execution. First prove discovery, authorization,
consent, token exchange, bearer validation, actor resolution, and a read-only
tool end to end.

## Primary references

- [MCP 2026-07-28 authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP authorization server discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)
- [MCP client registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration)
- [MCP authorization security considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Effect MCP protocol adapters](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/ai/McpProtocol.ts)
- [Effect MCP server implementation](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/ai/McpServer.ts)
- [OAuth 2.1 draft referenced by MCP](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13)
- [RFC 9728: protected resource metadata](https://www.rfc-editor.org/rfc/rfc9728.html)
- [RFC 8414: authorization server metadata](https://www.rfc-editor.org/rfc/rfc8414.html)
- [RFC 8707: resource indicators](https://www.rfc-editor.org/rfc/rfc8707.html)
- [RFC 9207: authorization server issuer identification](https://www.rfc-editor.org/rfc/rfc9207.html)
- [RFC 7009: token revocation](https://www.rfc-editor.org/rfc/rfc7009.html)
- [RFC 8252: OAuth for native apps](https://www.rfc-editor.org/rfc/rfc8252.html)
- [RFC 9700: OAuth security best current practice](https://www.rfc-editor.org/rfc/rfc9700.html)
