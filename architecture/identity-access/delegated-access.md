# Delegated access

Machine actors are organization-scoped identities: API keys, CLI authorizations,
and MCP authorizations. A credential authenticates the actor; active session-key
grants determine its delegated execution and signing authority. API keys can also
receive explicit workspace management permissions. OAuth scopes additionally
limit the operations available to CLI and MCP clients.

## API keys

Creation validates selected active session keys, generates a `namera_` credential,
and atomically inserts its actor, credential hash, grants, and audit/notification
records. Only creation returns the raw key. A key can have session grants, management permissions, or both. Existing keys
receive no management permissions. Expiration is required by the request
contract and limited to one year. Revocation disables both credential and grants.

### Workspace management

API keys persist an explicit permission array: `wallet:read`, `wallet:create`,
`session-key:read`, `session-key:create`, `session-key:install`,
`session-key:uninstall`, and `session-key:revoke`. Permissions cover every existing
and future resource in the key's organization, never another organization. A
human issuer needs `api-key:create` and the corresponding member permission;
install maps to member `session-key:create`, uninstall to `session-key:revoke`.
Issuance locks current membership before checking this subset. Keys cannot issue
other keys or change their own permissions; replacement and revocation are explicit.

Management reads deliberately widen account/session visibility only when that
resource's read permission is present. Execution history and signing retain their
existing grant-based visibility and authority. Creation grants the calling API-key
actor access to its new session in the same transaction; existing sessions never
receive an implicit grant from management access. Session creators can be humans
or API-key descriptors, including after credential revocation.

Creating and installing arbitrary sessions on managed accounts can confer full
account authority. The issuance UI and creation email identify workspace management
permissions. They are wallet administration capabilities, not restricted agent
spending credentials. Removal of a key's creator does not revoke the shared key.

Admission checks the current API-key permission, expiry and revocation before
provider work and again under its credential lock before committing. Owner
approval checks authority before signing and at signature acceptance. Billing,
wallet, audit and outbox boundaries remain intact. Signed work continues to
reconcile after revocation; unsigned work cannot be accepted with revoked authority.

API-key passkey registration requires an exact origin allowlisted at issuance,
HTTPS except HTTP localhost development. The RP ID is the approved origin's host.
Ceremonies bind organization, initiating actor, challenge, origin and expiry; they
are independent for concurrent application users and single-use at account creation.
The application backend must authenticate its own user and bind that user to the
pending ceremony. The stored signer retains its origin for later passkey owner
approval; legacy rows retain dashboard-origin behavior. API keys remain on the
backend and never replace the user's cryptographic signature.

Session installation/removal uses the existing prepare, approve/complete, status,
recovery and cancellation HTTP endpoints. The SDK resolves owner type internally.
API-key operations can be approved, recovered or cancelled only by their initiating
actor; status polling is similarly actor-bound. Preparation never signs. Uninstall
can remove one installed network of an active session without revoking its other
networks; session revocation separately disables server grants and cancels unsigned
installs. Receipt confirmation determines whether onchain removal succeeded.

Boundary tests cover workspace-wide management, independent permissions, legacy
execution-only keys, issuer subset checks, actor/tenant isolation, origin-bound
passkey approvals and revocation during managed signing. SDK tests cover internal
idempotency, owner dispatch and recovery without exposing retry keys.

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

Machine reads without explicit management read permissions join current active
grants rather than filtering an organization-wide response in memory. Confirmed execution history is visible through the currently
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
