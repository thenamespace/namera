# @namera-ai/sdk

Browser- and Node-compatible client for API-key and OAuth-bearer access to the Namera API.
The SDK uses the schema-derived `@namera-ai/api` HTTP client internally, but its
public methods return ordinary promises and do not expose Effect programs.

See [SDK, CLI, and MCP tools](../../architecture/clients/sdk-cli-mcp.md) for the
shared capability surface, authentication modes, and retry contract. See
[client workspace architecture](../../architecture/packages/clients.md) for
SDK/CLI ownership and extension rules.

## Usage

```ts
import { NameraClient } from "@namera-ai/sdk";

const namera = new NameraClient({
  apiKey: process.env.NAMERA_API_KEY!,
});

const wallets = await namera.wallets.list();

if (!wallets.success) {
  console.error(wallets.error.message);
  return;
}

console.log(wallets.data);
```

Interactive clients may instead provide a bearer token or an asynchronous token
supplier. The latter lets the caller refresh credentials without rebuilding the
client:

```ts
const namera = new NameraClient({
  baseUrl: "http://localhost:8080",
  getAccessToken: refreshAccessToken,
});
```

Every operation resolves to `NameraResult<A, E>`:

```ts
type NameraResult<A, E> =
  | { success: true; data: A; error: null }
  | { success: false; data: null; error: NameraSdkError<E> };
```

For declared API failures, `error.kind === "api"` preserves the endpoint's
exact error union in `error.cause`. Narrow its `_tag` to get the corresponding
typed `code` and fields without casting:

```ts
const wallet = await namera.wallets.get(walletId);

if (!wallet.success && wallet.error.kind === "api") {
  if (wallet.error.cause._tag === "WalletError") {
    console.error(wallet.error.cause.code); // "WALLET_NOT_FOUND"
  }
}
```

The current development default is `http://localhost:8080`. Use `baseUrl` to
target another self-hosted or deployed server. A Fetch-compatible runtime is
used automatically; `fetch` may be supplied explicitly for nonstandard
runtimes and tests.

## Supported API-key operations

- `wallets.list`, `wallets.get`
- `sessionKeys.list({ walletId? })`, `sessionKeys.get`
- `executions.simulate`, `executions.execute`, `executions.getStatus`,
  `executions.list`
- `executions.prepare`, `executions.complete` — detached execution transport
- `signatures.prepare`, `signatures.complete` — detached signature transport
- `sign`, `verifySignature`

Resource operations are intentionally grouped. Signing and verification remain
at the root because they are cross-resource signature capabilities rather than
collections. Verification is read-only and does not consume signature usage.

Simulation is read-only and reports call success separately from session-key
policy eligibility. Simulation and execution requests require `sessionKeyId`
separately from `walletId`, identifying the installed session to use.
`executions.execute` sponsors gas by default; callers may set
`sponsor: false` to pay gas from the smart account without consuming sponsored-gas
credits. Both modes consume execution usage. Execution and signing methods generate an idempotency key internally before
the first request. The same key is reused for up to three retries with bounded
exponential backoff when the failure is a network interruption, HTTP 408, or
HTTP 5xx response. Validation, authorization, policy, rate-limit, billing, and
other declared API failures are returned immediately and are never retried.
Callers do not supply or manage idempotency keys.

Detached execution uses `prepare` to obtain an unsigned operation and `complete`
to return the local session signature. Preparation retries reuse one generated
key; completion retries reuse the same submission and signature. `prepared` in
the completion response means queued, not broadcast or confirmed. These methods
only provide transport: callers must independently validate the prepared hash,
chain, account, calls, and session authority before signing.

`executions.execute` performs this orchestration when `resolveSessionSigner` is
configured. The resolver returns a `LocalSessionSigner` from trusted local
storage: its public installation binding, an EIP-191 signing callback, and an
explicit `maxGasCostWei` allowance for self-funded operations. The SDK never
receives private key bytes through this interface. Do not populate the binding
from the preparation response: it must originate from the owner-approved
installation/export. The CLI keystore and dashboard export integration remain
pending.

`sign` requires `sessionKeyId` and uses the same local resolver. Its binding must
explicitly set `allowSignatures: true`, and the signer must provide a
`signTypedData` callback. The SDK reconstructs Alchemy's replay-safe challenge
from the original payload and trusted wallet/chain binding, checks preparation
identity and expiry, verifies the local ECDSA signer, then completes. It checks
the returned ERC-1271 envelope against the signature it submitted. Completion
retries never sign again. The optional low-level `signatures.prepare/complete`
methods provide transport only; direct callers own these validation checks.

API signature policy and expiry do not constrain direct local signing. Alchemy's
TimeRange hook does not expire ERC-1271 authority; onchain uninstall revokes it.

Before invoking the signer, the SDK checks wallet/session/installation/chain,
validity, canonical EntryPoint, session nonce selector, requested calldata,
execution-hook wrapper, and sponsorship/fee consent. It recomputes the hash
locally with Viem and checks the returned signature's address. Completion
retries never invoke the signer again. Local signing failures use `kind:
"signer"` and stable codes without exposing keystore exceptions. A missing
resolver fails before any request; there is no root-key fallback.

`sealLocalSessionKey` / `openLocalSessionKey` provide the browser-compatible
encrypted export codec described in
[local keystores](../../architecture/clients/local-keystore.md). They accept
redacted passwords, use WebCrypto, and validate signer/key correspondence.
They do not read files, contact the API, or prove installation approval. The
client-only schemas live in `@namera-ai/protocol/local`, not API DTOs.

## Structure

- `src/client.ts` — public `NameraClient` facade.
- `src/wallets.ts`, `src/session-keys.ts`, `src/executions.ts` — focused resource
  clients.
- `src/transport.ts` — internal generated HttpApi client, authentication
  middleware, and transient retry boundary.
- `src/result.ts` — promise result and SDK error contracts.
- `src/signing/` — local signer contract and independent execution validation.
- `src/index.ts` — intentional public exports.
- `tests/` — transport-boundary contract tests using an injected Fetch function.
- `package.json` — package metadata, scripts, source condition, and publish exports.
- `tsconfig.json` — Node package TypeScript configuration.
- `tsdown.config.ts` — unbundled ESM build and declaration output.

## Development

Add only operations supported by API-key actors. Call the generated
`@namera-ai/api` client instead of hand-building paths or repeating schema
encoding. Keep Effect inside the package boundary and convert each operation to
`NameraResult` in the shared transport. Preserve the `namera-source` condition
and run the package tests and build before publishing.
