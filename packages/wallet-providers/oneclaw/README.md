# @namera-ai/wallet-provider-oneclaw

Internal, SDK-backed Effect services for 1Claw organization setup, delegated
agent creation, Ethereum signing-key setup, and exact-digest signing. This package
does not create smart accounts, broadcast transactions, write to the database,
or enable managed custody in Namera's public API.

## Services

`OneClawService.layer` provides these operation groups:

| Group         | Operations                                                         | Authentication                                        |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| `connections` | `upsert`, `findBySubject`, `get`, `bootstrapEmpty`, `reissueClaim` | Platform key                                          |
| `customers`   | `redeemClaim`, `getIdentity`, `enableDelegation`                   | Claim, then customer token                            |
| `agents`      | `create`, `get`, `setRawSigningEnabled`                            | Delegated Platform create; customer for reads/updates |
| `signingKeys` | `create`, `list`, `destroy`                                        | Customer; destruction always returns `UNSUPPORTED`    |
| `signing`     | `signDigest`                                                       | Agent API key exchanged for a fresh access token      |

```ts
import { Effect } from "effect";
import { OneClawService } from "@namera-ai/wallet-provider-oneclaw";

const recoverConnection = (subject: string) =>
  Effect.gen(function* () {
    const claw = yield* OneClawService;
    return yield* claw.connections.findBySubject(subject);
  });
// The server composition root supplies OneClawService.layer when integrating it.
```

Setup uses `OneClawOrganizationSetupRequest` with a reconciled pending connection.
The configured template must be active, owned by the configured app, match the
pinned version, and have exactly `spec: {}`. The bootstrap result contains a
redacted claim, not an agent credential. The SDK cannot atomically pin a template
version in a bootstrap request; freeze this dashboard template to avoid an
edit between validation and bootstrap. Unexpected resources fail closed and
require investigation, not another bootstrap.

`customers.redeemClaim` takes that claim and the connection's expected customer
ID. It checks `/v1/auth/me` before returning a redacted customer token and expiry.
Other customer operations require `OneClawCustomerAuthority`, validating its
organization/connection/credential bindings, configured app, expiry, and remote
customer identity. Granting delegation sets only `agents:read` and `agents:write`
and verifies a delegated list request; later agent creation verifies write access.

`agents.create` accepts a ready `OneClawOwnerProvisioningRequest`, its bound
customer authority, and a name. Every account uses this same delegated flow.
The one-time agent credential returns immediately: application must encrypt and
persist it **before** creating a signing key or making another network call.
`signingKeys.create` creates Ethereum/secp256k1 only. Broader persisted chain
variants do not imply that this adapter implements those operations.

`signDigest` takes a decoded `OneClawAgentCredentialPayload`, pinned `EthereumKey`,
and exactly 32 digest bytes. It exchanges the agent key explicitly (no human-key
fallback or long-lived access-token cache), checks fresh key ID/version/curve/
address/public point, and verifies the returned signature against that exact
digest and public key. It returns the provider's verified 65-byte recoverable
signature; EVM owns validator-specific encoding. There is no rehashing or
transaction submission. Concurrent remote key rotation can still race signing;
the signature check rejects a changed signer.

Application owns tenant authorization, remote/local resource association,
connection setup leases, encrypted credentials, renewal coordination, billing,
transactions, audits, and recovery. These operations do not replace those checks.

## OIDC

`OneClawOidcService.layer` is separate from the API client. `issue` accepts an
organization ID, stable Namera-controlled org email, and display name. It issues
a 120-second RS256 ID token with subject `namera:org:<id>`. Only use controlled
emails: `email_verified` is asserted by Namera. `publicJwks` exposes public RSA
fields only. It does not host discovery/JWKS HTTP routes or register app trust.
Server routes, key rotation/overlap, and full OIDC empty-bootstrap deployment
verification remain integration work. Do not use an arbitrary member's email.

## Configuration

The server env examples contain all fields. Values are loaded only when the
corresponding layer is built; public runtime composition is unchanged.

| Variable                         | Meaning                                           |
| -------------------------------- | ------------------------------------------------- |
| `ONECLAW_PLATFORM_APP_ID`        | Dashboard-created Platform app ID                 |
| `ONECLAW_PLATFORM_API_KEY`       | Redacted Platform API key, not a human API key    |
| `ONECLAW_EMPTY_TEMPLATE_ID`      | Dashboard-created empty template                  |
| `ONECLAW_EMPTY_TEMPLATE_VERSION` | Required pinned integer version                   |
| `ONECLAW_API_BASE_URL`           | Defaults to `https://api.1claw.co`                |
| `ONECLAW_REQUEST_TIMEOUT`        | Per SDK call wait limit; defaults to `30 seconds` |
| `ONECLAW_OIDC_ISSUER`            | Exact issuer registered in the Platform app       |
| `ONECLAW_OIDC_AUDIENCE`          | Exact audience registered in the Platform app     |
| `ONECLAW_OIDC_KEY_ID`            | Stable signing key ID published in JWKS           |
| `ONECLAW_OIDC_PRIVATE_KEY`       | Redacted RSA PKCS#8 PEM; literal `\n` accepted    |

Customer/agent credentials are not deployment env vars. Later application
workflows protect them with the existing `CRYPTO_ENCRYPTION_KEY` and
`cryptoPurpose.providerCredential`.

## Errors and timeouts

`OneClawError` and its bounded operations/codes live in protocol. Central
`fromOneClawResponse` / `fromOneClawException` converters remove vendor bodies,
messages, URLs, and credentials. HTTP status is retained when known. Runtime
schema errors are also sanitized. Check HTTP status even for SDK responses
with `error: null` (notably upsert's 409 `link_required`). Approval, rate limit,
auth failure, identity mismatch, key mismatch and timeout are distinct outcomes.

SDK `0.61.38` does not accept an AbortSignal or injectable fetch. Effect bounds
the caller's wait, but **cannot cancel the remote request**. Timeout, interruption,
network failure, or invalid response after a mutation may mean it succeeded.
No operations are retried automatically, including reads; application can choose
a bounded read/reconciliation policy. Never retry ambiguous create/bootstrap
calls, discard a possibly returned one-time credential, or claim rollback.
No SDK x402 signer is configured, so payments cannot be authorized automatically.

Provider spans use fixed `wallet-providers.oneclaw.*` names with no payload
attributes. OIDC issuance is untraced. No provider logs or metrics are added.
Do not enable HTTP instrumentation that captures claim-token paths or auth headers.

## Tests and dependencies

Tests exercise the real SDK over substituted fetch, without network or secrets.
`oneClawTestLayer(scenario)` offers typed scenario overrides to downstream tests;
unconfigured operations fail `UNSUPPORTED` (subject lookup defaults to none).
`OneClawTestControl.calls` is an isolated Ref containing operation names only.

The user-requested `@1claw/sdk` is pinned to the tested `0.61.38`. Existing repo
libraries `jose`, `viem` and `ox` provide JWT issuance and public-key/signature
verification instead of custom cryptography. No SDK types are exported.

```sh
pnpm --filter @namera-ai/wallet-provider-oneclaw test
pnpm --filter @namera-ai/wallet-provider-oneclaw typecheck:test
pnpm --filter @namera-ai/wallet-provider-oneclaw build
```
