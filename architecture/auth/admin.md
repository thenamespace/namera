# Platform admin authorization

Platform operators use `Authorization: Bearer <ADMIN_TOKEN>` on explicitly
protected internal routes. This is separate from organization administrators:
an organization owner, API key, CLI token, or MCP token cannot administer the
platform. The admin token cannot authenticate normal user or wallet routes.

`AdminAuthorization` in `packages/api` declares the bearer requirement and provides
the request-scoped `CurrentAdmin` context (`type: "admin"`,
`credential: "shared-token"`). `AdminAuthorizationLive` in `apps/server` loads
`ADMIN_TOKEN` through redacted configuration and compares SHA-256 digests in
constant time. Missing or shorter-than-32-character configuration disables admin
access. The old `INVITE_ADMIN_TOKEN` variable is not accepted.

The context is deliberately not part of `CurrentActor` or persisted `auth.actor`:
those principals belong to organizations and participate in wallet grants and
tenant audit records. Platform administration must not implicitly bypass those
boundaries. No database migration is needed.

## Adding an admin operation

- Declare an internal API group with `.middleware(AdminAuthorization)`.
- Keep its server handler thin; it can read `CurrentAdmin` if needed. Implement
  business work in `application`, not in the middleware.
- Preserve domain-specific validation and add an operation-specific rate limit
  when required. All admin routes currently share 10 bearer attempts/minute/IP
  and 30 authenticated operations/hour. These counters are process-local.
- Persist the mutation and its appropriate audit event in one transaction.
  Invite creation/revocation already uses `audit.beta_invite_events`. A shared
  token identifies an operator credential, not an individual human; do not
  invent a user or organization actor for attribution.
- Add authentication, authority-isolation, and mutation/audit tests. The typed
  API boundary suite requires declared authentication on protected endpoints.

## Operations

Generate a random secret with `openssl rand -hex 32`, supply it through the server
secret manager, and restrict `/internal/*` at ingress to trusted operators. Use
HTTPS outside local development. Never ship the token to the dashboard, SDK,
CLI, or MCP, and never log it. Rotate by replacing it and restarting all server
instances. Responses receive the API's no-store security headers.

When multiple operators need independent revocation, permissions, or personal
audit attribution, replace the shared credential with named platform identities
and scoped credentials behind this same boundary. Do not expand tenant roles
into global admin authority.

Transport tests cover valid context injection, wrong credential kinds,
missing/short/legacy configuration, attempt throttling, tenant-token isolation,
and the invite routes' existing transactional audit behavior.
