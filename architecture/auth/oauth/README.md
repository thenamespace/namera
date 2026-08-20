# OAuth architecture

Namera uses one OAuth persistence and token model for two delegated client types:

- **MCP**: authorization code with PKCE `S256`, resource-bound bearer tokens, and Streamable HTTP at `/mcp`.
- **CLI**: device authorization, resource-bound bearer tokens, and rotating refresh tokens.

Both create a durable `auth.oauth_authorization`, a dedicated organization actor, and explicit `core.session_key_grant` rows. Scope allows a class of action; grants and session-key policies decide the concrete wallets/operations.

## Documentation

- [Authorization code and MCP consent](authorization-code.md)
- [CLI device flow](device-flow.md)
- [Tokens, validation, and revocation](tokens.md)
- [Complete OAuth tables](../../database/auth-oauth.md)

## Components

| Component                     | Responsibility                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Authorization-server metadata | Advertise protocol endpoints and capabilities.                                                  |
| Protected-resource metadata   | Advertise `/mcp` authorization servers/scopes.                                                  |
| Client registration           | Validate public client metadata and exact redirects.                                            |
| Authorization request         | Validate client, redirect, response, PKCE, resource, and scope before browser consent.          |
| Consent/device approval       | Bind authenticated user, organization, selected session keys, actor, and durable authorization. |
| Token endpoint                | Consume code/device state or rotate refresh tokens.                                             |
| Authorization middleware      | Validate access token, client/grant status, resource, expiry, and scopes.                       |
| Management API/dashboard      | List/get/revoke MCP and CLI grants separately using the common model.                           |

## Supported scopes

| Scope               | Meaning                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `mcp:read`          | Use MCP read tools.                                                      |
| `mcp:execute`       | Use MCP execution/signature tools, still constrained by grants/policies. |
| `wallet:read`       | Read granted wallet information through API/CLI.                         |
| `session-key:read`  | Read granted session-key information.                                    |
| `execution:read`    | Read grant-scoped execution history/status.                              |
| `execution:execute` | Simulate and execute transactions through granted session keys.          |
| `signature:create`  | Create policy-authorized signatures.                                     |
| `offline_access`    | Receive rotating refresh tokens.                                         |

MCP authorization accepts the complete supported set subject to client registration. CLI device authorization accepts the non-MCP API scopes plus `offline_access`.

## Public-client security model

- Token endpoint authentication method is `none`; clients cannot protect a shared secret.
- Authorization code always requires PKCE `S256`.
- Redirect URI matching is exact after registration validation.
- HTTPS is required except loopback HTTP (`localhost`, `127.0.0.1`, `[::1]`).
- Redirect and metadata URLs reject fragments and embedded credentials.
- Tokens and codes are hashed; short user codes are HMAC-protected.
- Access/refresh tokens are audience/resource-bound.

## Protocol transport

OAuth form endpoints enforce their expected media type, duplicate/unknown parameter rules as implemented by protocol parsers, safe error redirects, and `Cache-Control: no-store`. Dashboard management endpoints use typed JSON `HttpApi` contracts and user authorization middleware.

## Pending before production

- Complete OAuth conformance and malicious-client tests.
- Define dynamic registration trust/rate policy and client disable procedures.
- Add cleanup for expired request/code/device/token rows.
- Adopt a newer MCP protocol revision only when the Effect transport supports it and compatibility tests pass.
