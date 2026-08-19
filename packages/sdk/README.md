# @namera-ai/sdk

Browser- and Node-compatible client for API-key and OAuth-bearer access to the Namera API.
The SDK uses the schema-derived `@namera-ai/api` HTTP client internally, but its
public methods return ordinary promises and do not expose Effect programs.

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
  baseUrl: "https://api.namera.ai",
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

Use `baseUrl` for self-hosted or local servers. A Fetch-compatible runtime is
used automatically; `fetch` may be supplied explicitly for nonstandard
runtimes and tests.

## Supported API-key operations

- `wallets.list`, `wallets.get`
- `sessionKeys.list`, `sessionKeys.listForWallet`, `sessionKeys.get`
- `executions.execute`, `executions.getSubmission`, `executions.get`,
  `executions.list`
- `sign`

Resource operations are intentionally grouped. Only `sign` remains at the root
because it is a cross-resource signing capability rather than a collection.

Execution and signing methods generate an idempotency key internally before
the first request. The same key is reused for up to three retries with bounded
exponential backoff when the failure is a network interruption, HTTP 408, or
HTTP 5xx response. Validation, authorization, policy, rate-limit, billing, and
other declared API failures are returned immediately and are never retried.
Callers do not supply or manage idempotency keys.

## Structure

- `src/client.ts` — public `NameraClient` facade.
- `src/wallets.ts`, `src/session-keys.ts`, `src/executions.ts` — focused resource
  clients.
- `src/transport.ts` — internal generated HttpApi client, authentication
  middleware, and transient retry boundary.
- `src/result.ts` — promise result and SDK error contracts.
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
