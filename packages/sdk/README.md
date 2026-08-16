# @namera-ai/sdk

Browser- and Node-compatible client for the API-key-authenticated Namera API.
The SDK uses the schema-derived `@namera-ai/api` HTTP client internally, but its
public methods return ordinary promises and do not expose Effect programs.

## Usage

```ts
import { NameraClient } from "@namera-ai/sdk";

const namera = new NameraClient({
  apiKey: process.env.NAMERA_API_KEY!,
});

const wallets = await namera.getWallets();

if (!wallets.success) {
  console.error(wallets.error.message);
  return;
}

console.log(wallets.data);
```

Every operation resolves to `NameraResult<A>`:

```ts
type NameraResult<A> =
  { success: true; data: A; error: null } | { success: false; data: null; error: NameraSdkError };
```

Use `baseUrl` for self-hosted or local servers. A Fetch-compatible runtime is
used automatically; `fetch` may be supplied explicitly for nonstandard
runtimes and tests.

## Supported API-key operations

- `getWallets`, `getWallet`
- `getSessionKeys`, `getSessionKeysForWallet`, `getSessionKey`
- `executions.execute`, `executions.getSubmission`, `executions.get`,
  `executions.list`
- `sign`

Grouped `wallets` and `sessionKeys` clients expose the same reads when a grouped
call style is clearer.

## Structure

- `src/client.ts` — public `NameraClient` facade.
- `src/wallets.ts`, `src/session-keys.ts`, `src/executions.ts` — focused resource
  clients.
- `src/transport.ts` — internal generated HttpApi client and API-key middleware.
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
