# Delegated access

Machine actors are organization-scoped identities: API keys, CLI authorizations,
and MCP authorizations. A credential authenticates the actor; active session-key
grants determine which wallet authority it can use. OAuth scopes additionally
limit the operations available to CLI and MCP clients.

## API keys

Creation validates selected active session keys, generates a `namera_` credential,
and atomically inserts its actor, credential hash, grants, and audit/notification
records. Only creation returns the raw key. Expiration is required by the request
contract and limited to one year. Revocation disables both credential and grants.

## OAuth

The authorization server supports public clients without client secrets:

- Authorization code with exact registered redirects and PKCE `S256` for MCP.
- Device authorization for the pre-registered `namera-cli` client.
- Dynamic public-client registration with HTTPS or loopback HTTP redirects.

The resource audience is the API origin. The API checks the active client,
authorization, original approving membership, token audience, and the intersection
of token and authorization scopes. A schema value for metadata-document clients
does not imply live client metadata discovery.

Consent creates a dedicated actor and selected grants. Authorization codes are
single use. Access tokens last fifteen minutes; refresh tokens last thirty days
and rotate within a token family. Codes and tokens are stored as hashes; device
user codes use HMAC. Refresh reuse can invalidate the family. Consent revocation
invalidates authorization, tokens, and grants in one transaction.

CLI device requests last ten minutes and begin with a five-second polling
interval. Browser claim/approval binds the request to the approving user and
organization. OAuth approval and revocation generate audit and inbox records,
not email jobs.

## Data visibility

Machine reads join current active grants rather than filtering an organization-wide
response in memory. Confirmed execution history is visible through the currently
granted session keys, even when another actor originally submitted it. Submission
status is narrower: only its initiating actor can poll it.

Owner transactions and owner signatures are human-only dashboard operations.
Possessing a session grant or OAuth scope does not confer root-wallet authority.
Local MCP transport runs in the CLI; the server provides OAuth and delegated HTTP
operations, not a hosted MCP transport.

## Source

- [API-key workflow](../../packages/application/src/auth/core/api-key.ts)
- [OAuth workflows](../../packages/application/src/auth/oauth/)
- [Actor enforcement](../../apps/server/src/helpers/actor.ts)
- [Delegation persistence](../data/identity-access.md)
