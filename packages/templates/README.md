# @namera-ai/templates

Reusable session permission builders for Namera's programmable wallets. Use the
same built-in templates as the dashboard, or define custom templates in your
application. Builders validate inputs locally and return permissions for the
existing `@namera-ai/sdk` session creation method.

## Requirements

Node.js 24.14+ or a modern browser with native bigint support. Building requires
no credentials or network connection. Creating sessions requires the SDK and an
API key with explicit workspace provisioning permissions.

## Installation

```sh
npm install @namera-ai/templates
pnpm add @namera-ai/templates
yarn add @namera-ai/templates
bun add @namera-ai/templates
```

Also install `@namera-ai/sdk` to create sessions:

```sh
npm install @namera-ai/sdk
pnpm add @namera-ai/sdk
yarn add @namera-ai/sdk
bun add @namera-ai/sdk
```

## Quick start

Save this as `index.ts` and run `node index.ts`:

```ts
import { usdcAllowanceTemplate } from "@namera-ai/templates";

const now = Math.floor(Date.now() / 1000);
const permissions = usdcAllowanceTemplate.build(
  {
    networks: ["eip155:5042002"],
    allowance: "100",
    expiresAt: new Date((now + 7 * 86_400) * 1000).toISOString(),
  },
  { now },
);

console.dir(permissions, { depth: null });
```

This builds a seven-day lifetime allowance of 100 USDC on Arc testnet. Output
contains `onchain` and `policies`; token amounts are bigint base units. Invalid
inputs throw synchronously. Building does not create or activate a session.

## Create a session

Set `NAMERA_API_KEY` and `NAMERA_WALLET_ID` in your backend environment. The key
needs `session-key:create`, `session-key:read` and `wallet:read`. Add this code
after the quick-start example:

```ts
import { NameraClient } from "@namera-ai/sdk";

const namera = new NameraClient({ apiKey: process.env.NAMERA_API_KEY! });
const session = await namera.sessionKeys.create({
  namespace: "eip155",
  walletId: process.env.NAMERA_WALLET_ID!,
  metadata: { version: 1, name: "USDC test agent" },
  signer: { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1" },
  ...permissions,
});
if (!session.success) throw new Error(session.error.message);

console.log(session.data);
```

Keep API keys out of browser bundles. Both managed and local session signers
accept template output; local registration supplies a public key, never a private
key. Session custody is independent of the account owner's approval method.

Creation leaves installation pending. With `session-key:install`, prepare each
network through `sessionKeys.prepareOperation()`, validate the prepared operation,
then approve it with the account owner and wait for confirmation. See the
[installation guide](https://namera.ai/docs/sdk/guides/accounts/install-session-keys).

## Built-in templates

`usdcAllowanceTemplate` grants a lifetime ERC-20 USDC allowance independently on
each selected network. Ethereum, OP Mainnet, Base, Arbitrum One, Arc and their
supported testnets are included. Amounts use six decimals; Arc's native gas USDC
uses 18 decimals separately. Transfers may go to any recipient. The template
grants no signatures, approvals or unrestricted contract access. Gas sponsorship
depends on the workspace's billing limits, separately from spending permissions.

`templates` lists built-in definitions. `getTemplate(id)` returns a definition or
`undefined`; the USDC template ID is `usdc-lifetime-allowance`.

## Custom templates

Export a deterministic builder returning `TemplateOutput`, or implement
`Template<typeof YourInputSchema>` with Effect Schema validation. `TemplateInput`
derives the accepted input type; `TemplateContext` supplies Unix time in seconds.
`UsdcAllowanceInput` is the built-in USDC input type. Definition versions describe
builder semantics; existing sessions keep their stored permissions after updates.

Custom definitions stay in your application or package. They do not automatically
appear in the hosted dashboard or change the built-in registry.

- [Templates documentation](https://namera.ai/docs/sdk/guides/templates)
- [USDC Spend Template](https://namera.ai/docs/sdk/guides/templates/usdc-allowance)
- [Create a custom template](https://namera.ai/docs/sdk/guides/templates/create-custom-template)
- [Test a custom template](https://namera.ai/docs/sdk/guides/templates/test-custom-template)
