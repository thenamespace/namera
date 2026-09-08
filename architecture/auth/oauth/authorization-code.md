# MCP authorization code and consent

The authorization-code path turns a public MCP client's validated request into an approved tenant actor, session-key grants, single-use code, and token family.

## Client registration

Dynamic registration:

- deduplicates and validates every redirect URI;
- accepts HTTPS or loopback HTTP only;
- rejects URL credentials and fragments;
- requires `authorization_code` and response type `code`;
- accepts only supported scopes without duplicates;
- stores public-client authentication method `none`;
- generates a random public `client_id` under the configured prefix.

Pre-registered and metadata-document client types share the same `auth.oauth_client` model but have different provenance/refresh responsibilities.

## Starting authorization

The server resolves public `client_id`, requires active status and exact redirect membership, requires response type `code`, validates PKCE challenge schema and method `S256`, deduplicates scopes, and verifies them against both server and optional client-registered scope. `offline_access` additionally requires refresh-token grant support.

The resource must be the canonical API origin (local MCP's upstream API client).
The removed hosted `/mcp` audience is rejected before creating an authorization
request. Root protected-resource metadata advertises the API origin. The CLI's
local MCP listener authenticates its agent-facing connection separately; a
loopback-audience bearer token is never passed upstream.

Only after these checks does it insert a pending authorization request and redirect the browser to `/oauth/authorize?requestId=...`.

## Consent sequence

```mermaid
sequenceDiagram
  participant MCP as MCP client
  participant Protocol as OAuth protocol routes
  actor User
  participant Dashboard as Consent UI
  participant App as OAuth application
  participant DB as PostgreSQL transaction
  MCP->>Protocol: Authorization request + PKCE + resource + scopes + state
  Protocol->>App: Start request
  App->>DB: Validate active client and insert pending request
  Protocol-->>MCP: Redirect browser to consent URL
  User->>Dashboard: Open consent request while signed in
  Dashboard->>App: Load pending request/client
  User->>Dashboard: Choose active session keys and approve
  Dashboard->>App: request ID, organization, actor, grants, optional expiry
  App->>DB: Revalidate pending request/client/session keys
  App->>DB: Conditionally approve request
  App->>DB: Insert mcp actor and durable authorization
  App->>DB: Insert active session-key grants
  App->>DB: Insert hashed single-use authorization code
  App->>DB: Insert audit and notifications
  DB-->>App: Commit consent atomically
  App-->>MCP: Exact redirect URI with raw code and original state
  MCP->>Protocol: Code + verifier + client ID + same redirect/resource
  Protocol->>App: Exchange code
  App->>DB: Atomically consume code and validate PKCE/grant
  App->>DB: Insert hashed access token and optional refresh token
  App-->>MCP: Raw token response, no-store
```

The code is generated before the consent transaction so only its digest enters PostgreSQL. It is returned only after the transaction commits.

## Approval invariants

- Optional authorization expiry must be in the future.
- Every selected session key must exist in the chosen organization and be active.
- Duplicate session-key IDs are removed before inserts/audit.
- Pending request approval is conditional; a concurrent approval/denial cannot create two grants.
- Actor, authorization, grants, code, audit, and notifications share one transaction.
- Approved scopes/resource/redirect/PKCE are copied from the persisted request, not browser-modifiable approval input.

## Denial

Denial conditionally marks the live request and redirects to the exact registered URI with `error=access_denied` and the original `state`. It does not create an actor, authorization, grant, or token.

## Token exchange checks

- Public client exists, is active, and supports authorization code.
- Verifier passes protocol schema.
- Hash resolves an unconsumed, unexpired code.
- Client internal ID, exact redirect URI, exact resource, and SHA-256 verifier challenge all match.
- Durable authorization remains active and belongs to the client.
- Code consumption and token insertion share a transaction.

## Pending before production

- Add end-to-end interoperability tests with Codex, Claude, and generic MCP OAuth clients.
- Test malicious redirect/state/PKCE/resource substitution and concurrent code redemption.
- Define approval expiry UI/policy and reauthorization behavior.
