# @namera-ai/sdk

A TypeScript client for Namera's self-custodial agent wallets. Inspect accounts
and session keys, simulate transactions, and execute or sign using local or managed
session keys. Methods return promises with typed success/error results.

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

Use the final API URL: the SDK does not follow redirects, including same-origin
redirects. Redirect responses fail without automatic retries, so credentials and
transaction payloads are not forwarded to another URL. A custom `fetch` must
honor the supplied `redirect: "manual"` option; it is trusted with your credentials.

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
| `executions.execute`        | Prepare, validate, sign by session custody, and submit        |
| `executions.getStatus/list` | Submission status and execution history                       |
| `executions.get`            | Confirmed execution details, receipt, and submitting actor    |
| `sign`                      | Authorized message or EIP-712 signing                         |
| `verifySignature`           | Verify a smart-account signature against its original payload |

Execution and simulation require a wallet and session key. Gas sponsorship
defaults to `true`; self-funded execution requires an explicit fee ceiling.
For managed sessions set `maxGasCostWei` on `NameraClient`; local resolvers retain
their `maxGasCostWei` setting.
Submission is not confirmation: check the returned submission's status.

### Send a transaction

Use an account and session key from your workspace. The session must allow the
recipient, amount, and selected network. Install `viem` to use `parseEther`.

```ts
import { NameraClient, type ExecuteRequest } from "@namera-ai/sdk";
import { parseEther } from "viem";

const namera = new NameraClient({ apiKey: process.env.NAMERA_API_KEY! });

const request = {
  namespace: "eip155",
  walletId: "0199dfe1-0000-7000-8000-000000000001",
  sessionKeyId: "0199dfe1-0000-7000-8000-000000000002",
  chainId: "eip155:84532",
  calls: [
    {
      to: "0x2222222222222222222222222222222222222222",
      value: parseEther("0.001"),
      data: "0x",
    },
  ],
  sponsor: true,
} satisfies ExecuteRequest;

const result = await namera.executions.execute(request);
if (result.success) {
  console.log(await namera.executions.getStatus(result.data.submissionId));
}
```

Replace the example IDs and recipient with your own. This sends test ETH on Base
Sepolia; gas sponsorship does not fund the transfer.

## Session signing

The same `executions.execute()` and `sign()` calls support local and 1Claw-managed
session keys. The server resolves custody from the selected session; managed keys
need no local import or `resolveSessionSigner`. Account ownership does not select
the session signing path. All calls still require grants, policies and confirmed
network installation.

Managed signature completion is not automatically retried. If its response is
lost, a new `sign()` call may charge another signature; results are not stored.
Execution retries reuse the same submission, not a new transfer.

### Local signing

In Node.js, the SDK automatically opens keys imported by the Namera CLI. Import
your encrypted dashboard export once on the machine running your application:

```sh
npx @namera-ai/cli session-key import <encrypted-export> --host https://api.namera.ai
```

Enter the export passphrase at the hidden prompt. After network approval and an
API-key grant, use the ordinary client; no signer callback is required:

```ts
import { NameraClient } from "@namera-ai/sdk";

const namera = new NameraClient({ apiKey: process.env.NAMERA_API_KEY! });
```

The SDK uses the same OS user, API origin, encrypted files, and keyring as the
CLI and local MCP. It loads storage only for a local signing challenge, never
for managed signing or read requests. Missing files or unavailable keyring access
return `LOCAL_SIGNER_UNAVAILABLE` without exposing native diagnostics. It never
creates a replacement key, changes custody, or falls back to plaintext storage.

Set `localSigning: false` to disable automatic storage access. An explicit
`resolveSessionSigner` takes precedence, including when automatic access is disabled.
For custom Node import workflows, `@namera-ai/sdk/node` exports `getSessionKeystore()`;
its `importKey(encryptedExport, redactedPassphrase, apiOrigin)` shares the CLI format.

Default encrypted-file directories:

| OS      | Directory                                           |
| ------- | --------------------------------------------------- |
| macOS   | `~/Library/Application Support/namera/session-keys` |
| Windows | `%APPDATA%\\Namera\\session-keys`                   |
| Linux   | `~/.config/namera/session-keys`                     |

`XDG_CONFIG_HOME`, when set, overrides these with `$XDG_CONFIG_HOME/namera/session-keys`.
The unlock secret is separate in the OS keyring. Linux uses Secret Service when
available; its keyutils fallback is memory-only and does not survive reboot.
Use an available persistent Secret Service for durable Linux imports. Headless
containers need provisioned storage and keyring access, or a custom resolver.

Browser bundles do not include native storage. Browsers and custom key stores
still use `resolveSessionSigner`. It returns a
`LocalSessionSigner` with a trusted installation binding and callbacks backed
by your local key store. The interface does not require exposing private-key bytes.

Bindings must come from the owner-reviewed configuration, **not** the server's
preparation response. Before signing, the SDK validates identity, chain, calls,
authority, expiry, operation hash, and gas consent. Missing signers fail closed;
there is no root-key fallback.

Custom integrations can implement `ResolveSessionSigner` and use
`sealLocalSessionKey` / `openLocalSessionKey` for portable encrypted exports.

Low-level `executions.prepare/complete` and `signatures.prepare/complete` provide
transport only; their callers must independently validate what they sign.
A local preparation returns its existing challenge; managed preparation returns
`signing: { method: "server" }`. Complete a managed operation with namespace and
operation/submission ID only. A supplied signature is rejected for managed keys,
and an omitted signature is rejected for local keys. There are no separate managed
execution/signature endpoints.

Browser owner-approval clients can use `validateOwnerApproval` for passkeys or
`validateManagedOwnerApproval` for a 1Claw-managed owner. Both require an
independently reconstructed account and compiled permission change, and reject
altered chain, authority, calls, deployment data, expiry and gas consent. The
managed guard does not sign: obtain explicit user confirmation before calling the
managed approval endpoint, and validate expiry again after that confirmation.

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

Declared errors preserve their typed cause. Preparation retries reuse one
idempotency key. Local completion retries reuse the exact local signature;
managed execution retries reuse the same stored operation. Managed signature
completion is not automatically retried. Validation, authorization and policy
failures are not retried automatically.

See [client behavior](https://github.com/thenamespace/namera/blob/main/architecture/clients/sdk-cli-mcp.md)
and [local key storage](https://github.com/thenamespace/namera/blob/main/architecture/clients/local-keystore.md).
API, protocol, SDK and CLI share a release version starting with 1.0.0.
