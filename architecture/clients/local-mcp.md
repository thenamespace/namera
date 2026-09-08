# Local MCP authorization

The CLI owns the OAuth broker in `services/mcp/oauth-broker.ts`. The broker and
upstream HTTP adapter and OAuth HTTP routes are implemented and tested; the
`namera mcp start` listener, tool wiring, and persistent credential lifecycle are
still pending. The API-hosted MCP transport has not yet been removed.

## Two audiences

```text
Agent → local OAuth issuer → bearer for http://127.0.0.1:<port>/mcp
Local broker → Namera OAuth issuer → bearer for the configured API origin
```

The local bearer is never sent to Namera. API credentials are never returned to
the agent. Each registered agent receives a distinct upstream public client;
Namera's existing consent page still selects the organization and session-key
grants. The broker does not reuse the CLI profile's broader authorization.

1. Register the agent's HTTPS or literal-loopback callback locally. Register a
   separate public client upstream with only the broker's loopback callback.
2. Validate the local authorization request's client, exact redirect, resource,
   supported scopes and `S256` challenge. Generate independent upstream PKCE
   material and state, then redirect to Namera's consent flow.
3. Consume upstream callback state once before exchanging its code. Keep API
   credentials redacted in process memory; return a new local code to the exact
   registered agent callback, preserving the agent's state.
4. Consume that code once, checking the agent's verifier, client, redirect and
   local resource. Return independent random local access/refresh tokens.
5. Resolve an incoming local bearer to its upstream credentials. The HTTP/tool
   adapter must additionally load the live API actor and grants before allowing
   any local signer access; broker lookup alone is not sufficient authorization.

## Lifetime and replay

- Pending authorization: 10 minutes. Local code: at most 60 seconds.
- Local access token: at most 5 minutes, capped by upstream expiry.
- Refresh family: at most 24 hours; requires registered refresh support and
  granted `offline_access`. Refresh cannot expand scopes.
- State/code/access/refresh lookup keys are domain-separated SHA-256 digests.
  Credentials needed for outbound requests are held as `Redacted` values.
- Each state collection is bounded to 128 entries; expired state is pruned on
  operations. Client registrations are bounded for the process lifetime.
- Code consumption and refresh freezing happen before provider calls. A
  duplicate refresh cannot rotate upstream twice. A frozen family cannot
  authenticate, but remains revocable. Revocation racing refresh prevents the
  returned credentials from minting a replacement local token.
- Ambiguous upstream refresh failure requires new consent; consumed refresh
  tokens are not automatically retried. A restart currently loses broker state
  and requires reauthorization rather than restoring plaintext credentials.

The upstream adapter uses fixed endpoints on the configured API origin, refuses
HTTP redirects, caps JSON responses at 32 KiB, applies a 15-second timeout, and
decodes registration/token responses with protocol schemas. It never forwards
provider response bodies through OAuth errors.

## Verification and remaining integration

CLI tests exercise real crypto with a controlled clock, a provider substitute
for broker races, and the actual HTTP adapter with injected Fetch. They cover
separate audiences, replay, redirect/PKCE binding, expiry, scope narrowing,
refresh/revoke concurrency, and malformed upstream responses. They do not prove
the HTTP listener or a live Namera consent journey yet.

The HTTP routes expose local issuer/resource metadata, registration, consent
redirect/callback, token exchange/refresh, and revocation. Denied consent consumes
the bound state and returns only `access_denied` to the registered callback.
Unknown state never redirects. Query/form duplicate parameters are rejected.
OAuth bodies are read through a 32 KiB bounded stream with a 10-second read
timeout; this does not depend on Web Request convenience getters honoring the
platform body-size setting.

The shared listener guard checks exact Host/Origin, caps URLs at 8 KiB, limits
registration to 10 requests/minute, other OAuth/discovery routes to 120/minute,
and MCP requests to 600/minute. It admits at most 32 requests concurrently;
overflow returns 503 without queuing. Responses receive no-store/no-referrer,
nosniff, and a restrictive CSP. Request URL logging must stay disabled because
OAuth callback URLs contain credentials. HTTP integration tests cover the
consent/token/revocation journey, safe denial, headers, duplicate parameters,
oversized bodies, host/origin rejection and registration limits. CLI source
and tests are both typechecked.

Remaining:

- Compose the OAuth routes and guard into the actual loopback listener. Verify
  concurrency limits and body/timeout behavior on the Node HTTP adapter as well
  as the in-memory HTTP boundary.
- Persist refreshable authorization securely in the OS keyring, with a defined
  restart/logout/revocation lifecycle and no plaintext fallback.
- Authenticate every MCP tool against the live API actor, bind MCP sessions to
  that authorization, and execute via the SDK/local keystore.
- Wire the CLI command, replace hosted-MCP tests, remove the API transport, and
  verify a browser-to-local-MCP consent/signing journey.
