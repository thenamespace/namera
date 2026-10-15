# @namera-ai/sdk

TypeScript client for Namera's programmable wallets. Read accounts and session
keys, simulate calls, submit transactions, and sign messages within delegated
permissions. Methods return promises with typed success and error results.

## Requirements

Node.js 24.14+ or a browser with Fetch and Web Crypto. Create an account, an active
session key, and an API key with the required grants in the dashboard. Keep API
keys in server-side applications, never public browser bundles.

## Installation

Choose your package manager:

```sh
npm install @namera-ai/sdk
pnpm add @namera-ai/sdk
yarn add @namera-ai/sdk
bun add @namera-ai/sdk
```

## Quick start

Set `NAMERA_API_KEY` in your environment. Save this as `index.ts` and run
`node index.ts`:

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

The default API is `https://api.namera.ai`. Set `baseUrl` for another deployment.

## Simulate a transaction

This example checks a zero-value call on Base Sepolia without submitting it.
Replace the example wallet ID, session-key ID, and recipient. The selected key
must have installed authority on that network and permit the call.

```ts
import { NameraClient, type ExecuteRequest } from "@namera-ai/sdk";

const namera = new NameraClient({ apiKey: process.env.NAMERA_API_KEY! });
const request = {
  namespace: "eip155",
  walletId: "0199dfe1-0000-7000-8000-000000000001",
  sessionKeyId: "0199dfe1-0000-7000-8000-000000000002",
  chainId: "eip155:84532",
  calls: [{ to: "0x2222222222222222222222222222222222222222", value: 0n, data: "0x" }],
  sponsor: true,
} satisfies ExecuteRequest;

const result = await namera.executions.simulate(request);
if (result.success) console.log(result.data);
else console.error(result.error.message);
```

When ready to submit, pass the request to `namera.executions.execute()`.
Its successful response contains a `submissionId`; poll
`namera.executions.getStatus(submissionId)` for confirmation. Submission is not
confirmation. Repeating `execute()` creates a separate attempt.

## Authentication

Configure exactly one of `apiKey`, `accessToken`, or `getAccessToken`. An
asynchronous supplier lets your application refresh OAuth tokens:

```ts
import { NameraClient } from "@namera-ai/sdk";

const namera = new NameraClient({
  getAccessToken: async () => {
    const token = process.env.NAMERA_ACCESS_TOKEN;
    if (!token) throw new Error("Set NAMERA_ACCESS_TOKEN");
    return token;
  },
});

const result = await namera.sessionKeys.list();
if (result.success) console.log(result.data);
else console.error(result.error.message);
```

Authentication does not bypass grants, policies, or onchain installation checks.

## Signing and fees

Local and 1Claw-managed sessions use the same `executions.execute()` and `sign()`
methods. Managed sessions need no local key. For local sessions, import the
dashboard's encrypted export with the CLI:

```sh
npx @namera-ai/cli session-key import <encrypted-export> --host https://api.namera.ai
```

The Node SDK opens that encrypted store only when local signing is needed. It
must run as the same OS user against the same API origin, with an accessible
keyring. There is no plaintext fallback. Browser integrations use an explicit
`resolveSessionSigner`; `localSigning: false` disables Node's automatic resolver.

The SDK validates prepared calls, account, network, authority, expiry, and fee
consent before local signing. Custom signer bindings must come from the
owner-approved configuration, not the server preparation being validated.

Gas sponsorship defaults to `true`. Self-funded execution requires an explicit
`maxGasCostWei` ceiling on the client, or on a custom local signer. Sponsorship
pays gas, not transferred value. Message signing requires separate signature
permission; transaction expiry does not revoke existing onchain signature authority.

## Results and retries

Successful calls return `{ success: true, data }`. Failures return
`{ success: false, error }`; `error.kind` distinguishes API, contract, network,
signer, and unexpected failures. Declared API failures retain their typed `cause`.

Preparation retries reuse one idempotency key. Execution completion retries reuse
the same submission and signature. Managed signature completion is not retried
automatically: a new signing call after a lost response may consume another
signature allowance. Low-level `prepare`/`complete` methods expose transport;
callers must independently validate any payload they sign.

Authenticated requests reject redirects. Configure the final API URL. An injected
`fetch` is trusted with credentials and must honor the manual redirect policy.

## Documentation

- [SDK guides and reference](https://namera.ai/docs/sdk)
- [Client architecture](https://github.com/thenamespace/namera/blob/main/architecture/integrations/sdk.md)
- [Local key storage](https://github.com/thenamespace/namera/blob/main/architecture/integrations/local-keys.md)

Use matching versions of the SDK, API, protocol, and CLI packages.
