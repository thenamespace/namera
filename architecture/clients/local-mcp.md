# Local MCP authorization

The CLI owns the OAuth broker in `services/mcp/oauth-broker.ts`. The broker and
upstream HTTP adapter, OAuth HTTP routes, and SDK-backed MCP tools are implemented
and tested through the HTTP boundary. `namera mcp start` composes them into a
Node HTTP listener bound only to `127.0.0.1`. Persistent credential lifecycle is
still pending. The API-hosted MCP transport is removed; OAuth consent, tokens,
and authorization management remain on the API. Only API-origin resources are
accepted upstream.

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
   adapter loads the live API actor and grants on every request before allowing
   any local signer access; broker lookup alone is not sufficient authorization.

## Tool authorization and local signing

The composed routes expose ten SDK-backed tools. Execution and signing require
explicit wallet and session-key IDs. No tool accepts a private key, filesystem
path, fee ceiling, or upstream credential. The locally configured signer resolver
checks the live grant's wallet, namespace, session ID, and active status before
opening the keystore. The SDK then validates the prepared operation against the
locally imported binding before signing; the API rechecks authority at completion.

Effective scopes are the intersection of the local token and live upstream
authorization. Each MCP protocol session is bound to its local OAuth client and
upstream authorization ID. A different authorization cannot reuse that session,
and revocation or scope narrowing applies to subsequent requests. Authentication
recognizes both HTTP status errors and the SDK's declared Unauthorized/Forbidden
errors. API requests refuse redirects and have a 30-second deadline.

Tool failures return bounded human-readable codes and schema-validated policy
diagnostics, never raw SDK/provider/keystore errors. Execution results distinguish
queued preparation from confirmation; descriptions warn that repeating an
execution tool call can transfer twice. Signing and execution are not advertised
as idempotent. Local SDK retries retain the operation's completion idempotency key.

The installed Effect MCP transport retains protocol sessions until process exit.
The adapter therefore caps successful/in-flight initializations at 128 for the
listener lifetime rather than pruning only its own authorization bindings and
leaking unbounded transport sessions. Restart requires OAuth reauthorization.

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
a live Namera consent/signing journey yet. A Node socket test additionally covers
discovery, forged Host/Origin rejection, the OAuth challenge, oversized declared
bodies, oversized chunked bodies without Content-Length, continued listener
health after rejection, and port release after disposing the listener.
A separate real-socket regression holds 32 token requests at the broker boundary,
checks that the next discovery request returns 503 with Retry-After/no-store,
then releases the requests and verifies discovery succeeds. The broker exchange
is substituted to control request lifetime; this proves admission/release at
the Node transport, not OAuth validity or slow-header timeout behavior.

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

The Node listener has a 10-second header deadline and a 30-second request-body
deadline. A declared oversized Content-Length is rejected with 413 before body
consumption; absent/chunked lengths still meet the streaming limit (the Node
adapter can close the connection when consumption exceeds it). CLI output is
emitted only after binding, uses the global output format, and honors quiet mode.
Neither request logs nor the framework's separate listen log are enabled.
API origin configuration rejects non-loopback HTTP, credentials, paths, queries,
and fragments. CLI profile/API-key credentials are deliberately not reused.

Remaining:

- Verify slow-header and slow-body deadlines on the Node HTTP adapter beyond
  the existing body rejection, concurrent admission and lifecycle coverage.
- Persist refreshable authorization securely in the OS keyring, with a defined
  restart/logout/revocation lifecycle and no plaintext fallback.
- Verify a browser-to-local-MCP consent/signing journey and live-chain execution.
  HTTP tests already exercise a real secp256k1 signer with injected API preparation
  and completion, including rejection of a changed payload before signing.

MCP call counters are updated in the CLI through the existing shared telemetry
definition, tagged only with the fixed tool name and success/error. Tool spans
contain no arguments, credentials or signatures. Export is not enabled by default
on the user's machine; the counters remain in-process. Hosted transport tests
were replaced by CLI OAuth/HTTP/SDK tests and API-origin OAuth integration tests.
