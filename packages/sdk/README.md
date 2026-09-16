# @namera-ai/sdk

A TypeScript client for Namera's self-custodial agent wallets. Inspect accounts
and session keys, simulate transactions, and execute or sign using a local
session signer. Methods return promises with typed success/error results.

## Installation

```sh
npm install @namera-ai/sdk
pnpm add @namera-ai/sdk
yarn add @namera-ai/sdk
bun add @namera-ai/sdk
```

Choose one command. Requires Node.js 24.14+ or a modern browser with Fetch and
Web Crypto. Never embed an API key in public frontend code.

## Quick start

```ts
import { NameraClient } from "@namera-ai/sdk";

const apiKey = process.env.NAMERA_API_KEY;
if (!apiKey) throw new Error("Set NAMERA_API_KEY");

const namera = new NameraClient({ apiKey });
const result = await namera.wallets.list();

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.message);
}
```

The default API is `https://api.namera.ai`. For another deployment:

```ts
const local = new NameraClient({ apiKey, baseUrl: "http://localhost:8080" });
```

## OAuth authentication

Supply a bearer token or an asynchronous token supplier. The supplier can refresh
credentials from your own store without rebuilding the client.

```ts
const namera = new NameraClient({
  getAccessToken: async () => {
    const token = process.env.NAMERA_ACCESS_TOKEN;
    if (!token) throw new Error("No access token available");
    return token;
  },
});

const sessions = await namera.sessionKeys.list();
if (sessions.success) console.log(sessions.data);
```

Authentication does not grant unrestricted access. Namera checks the actor's
session-key grants and the selected key's policies.

## Operations

| Method                      | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `wallets.list/get`          | Available accounts                                            |
| `sessionKeys.list/get`      | Authorized session keys                                       |
| `executions.simulate`       | Simulate calls and check policy eligibility                   |
| `executions.execute`        | Prepare, validate, sign locally, and submit                   |
| `executions.getStatus/list` | Submission status and execution history                       |
| `sign`                      | Authorized message or EIP-712 signing                         |
| `verifySignature`           | Verify a smart-account signature against its original payload |

Execution and simulation require a wallet and session key. Gas sponsorship
defaults to `true`; self-funded execution requires an explicit local fee ceiling.
Submission is not confirmation: check the returned submission's status.

## Local signing

Configure `resolveSessionSigner` to execute or sign. It returns a
`LocalSessionSigner` with a trusted installation binding and callbacks backed
by your local key store. The interface does not require exposing private-key bytes.

Bindings must come from the owner-reviewed configuration, **not** the server's
preparation response. Before signing, the SDK validates identity, chain, calls,
authority, expiry, operation hash, and gas consent. Missing signers fail closed;
there is no root-key fallback.

The CLI provides a ready-made encrypted local key store and resolver. Custom
integrations can implement `ResolveSessionSigner` and use
`sealLocalSessionKey` / `openLocalSessionKey` for portable encrypted exports.

Low-level `executions.prepare/complete` and `signatures.prepare/complete` provide
transport only; their callers must independently validate what they sign.

Namera's signature rules do not constrain direct local signing. Transaction
expiry does not itself expire ERC-1271 signature authority; uninstall that
authority onchain to revoke it.

## Errors and retries

```ts
const result = await namera.sessionKeys.list();
if (!result.success) {
  if (result.error.kind === "api") {
    console.error(result.error.cause._tag, result.error.message);
  } else {
    console.error(result.error.kind, result.error.message);
  }
}
```

Declared errors preserve their typed cause. Transient execution/signature retries
reuse one idempotency key; completion retries do not sign again. Validation,
authorization and policy failures are not retried automatically.

See [client behavior](https://github.com/thenamespace/namera-core/blob/main/architecture/clients/sdk-cli-mcp.md)
and [local key storage](https://github.com/thenamespace/namera-core/blob/main/architecture/clients/local-keystore.md).
API, protocol, SDK and CLI share a release version starting with 1.0.0.
