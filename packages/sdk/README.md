# @namera-ai/sdk

Scoped, revocable session keys for agents on Kernel 3.3 smart accounts (ERC-7579, EntryPoint 0.7), built on viem.

> Version 2 is a rewrite and is in development. It is not compatible with 1.x, and nothing in it is released yet.

## Install

```sh
pnpm add @namera-ai/sdk viem effect
```

## Entry points

| Entry                       | What it exports                                                               |
| --------------------------- | ----------------------------------------------------------------------------- |
| `@namera-ai/sdk`            | The Promise API: `Session`, `Grant`, `Bundler`, `Paymaster`, `Compat`, …      |
| `@namera-ai/sdk/effect`     | The same modules and names, with asynchronous functions returning an `Effect` |
| `@namera-ai/sdk/decorators` | `nameraActions()`, the optional viem decorator                                |
| `@namera-ai/sdk/otel`       | `Otel`, the optional OpenTelemetry bridge                                     |

Every module is also importable on its own (`@namera-ai/sdk/Session`).

## Accounts

Namera supports one account: ZeroDev's Kernel 3.3 on EntryPoint 0.7, deployed through its factory or on an EOA through
EIP-7702. Smart Sessions and SessionHook refuse to install on any other account.

Every account is viem's `SmartAccount`, so viem's bundler client, paymasters and wagmi use it unchanged.
`KernelAccount.from` is built on `SmartAccount.from`, which takes viem's `toSmartAccount` options. New accounts install
Smart Sessions in their deploying operation unless `sessions: false`.

```ts
import { KernelAccount, SmartAccount } from "@namera-ai/sdk"
import { createPublicClient, http, zeroAddress } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

const client = createPublicClient({ chain: base, transport: http() })
const owner = privateKeyToAccount(process.env.OWNER_KEY as `0x${string}`)
const account = await KernelAccount.from({ client, owner })

const bundler = createBundlerClient({ account, client, transport: http(process.env.BUNDLER_URL) })
await bundler.sendUserOperation({ calls: [{ to: zeroAddress, value: 1n }] })

await SmartAccount.detect(client, { address: account.address }) // { type: "kernel", version: "3.3", sessionsInstalled: true, … }
const existing = await SmartAccount.fromAddress({ client, address, owner }) // a Kernel 3.3 account another SDK created
```

`KernelAccount.fromEip7702` uses the owner's own address. As with any viem EIP-7702 account, the first user operation
carries the owner's signed authorization, and installs Smart Sessions:

```ts
import { signAuthorization } from "viem/actions"

const account = await KernelAccount.fromEip7702({ client, owner })
const authorization = await signAuthorization(client, account.authorization!)
await bundler.sendUserOperation({ calls, authorization })
```

### Passkey owners

A passkey (viem's `WebAuthnAccount`) can own a Kernel account. It verifies through Namera's
`WebAuthnValidator`, with the P-256 precompile where the chain has one, and its ERC-1271 signatures are bound to the
account and chain:

```ts
import { toWebAuthnAccount } from "viem/account-abstraction"

const owner = toWebAuthnAccount({ credential })
const account = await KernelAccount.from({ client, owner })

// Up to 16 passkeys, two of which sign each operation.
const shared = await KernelAccount.from({ client, owner: { passkeys: [laptop, phone, key], threshold: 2 } })
```

One prompt can sign user operations on several chains: prepare each with `SmartAccount.getMultichainStubSignature`
as its `signature`, then sign them together with `SmartAccount.signUserOperations`. EIP-7702 accounts take local keys
only.

### Owners after creation

`SmartAccount.getOwners` reads who controls an account. The owner functions change it, each as calls to batch
(`addOwnerCalls`), a sent user operation (`addOwner`) or one waited for (`addOwnerSync`):

```ts
const sets = await SmartAccount.getOwners(client, { address: account.address })

await SmartAccount.addOwnerSync(bundler, { owner: phonePasskey })
await SmartAccount.setThresholdSync(bundler, { threshold: 2 })
await SmartAccount.removeOwnerSync(bundler, { owner: lostPasskey })
await SmartAccount.replaceOwnerSync(bundler, { owner: oldKey, with: newKey })
await SmartAccount.addOwnerValidatorSync(bundler, { owner: passkey }) // a passkey on a key-owned account
```

Kernel's ECDSA validator holds one key, which `replaceOwner` rotates; an EIP-7702 account's owner is its own key.
Changes that would leave fewer passkeys than the threshold are refused before sending.

## Keys

A `Keystore` holds an agent's keys by curve (secp256k1, ed25519, p256) and signs inside the store; private keys never
leave it. `Keystore.toAccount` turns a secp256k1 key into a viem account.

```ts
import { Key, Keystore, SessionKey } from "@namera-ai/sdk"
import { Keystore as NodeKeystore } from "@namera-ai/sdk/node"

const store = NodeKeystore.osKeychain({ service: "my-agent" })
const key = await Keystore.create(store, { curve: "secp256k1", label: "agent-1" })
const agent = await Keystore.toAccount(store, { id: key.id }) // a viem account

const sessionKey = SessionKey.ecdsa(Key.address(key, "eip155")) // what the owner puts in the session
```

| Store                                  | Import                   | Where                                                 |
| -------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `Keystore.memory()`                    | `@namera-ai/sdk`         | anywhere; keys last as long as the process            |
| `Keystore.encryptedJson({ password })` | `@namera-ai/sdk`         | anywhere; export with `Keystore.toJson`               |
| `Keystore.from({ … })`                 | `@namera-ai/sdk`         | your own backend (a database, an HSM, a KMS)          |
| `Keystore.file({ path, password })`    | `@namera-ai/sdk/node`    | Node, Bun, Deno: one encrypted `0600` file per key    |
| `Keystore.osKeychain({ service })`     | `@namera-ai/sdk/node`    | the OS keychain, with the optional `@napi-rs/keyring` |
| `Keystore.webCrypto()`                 | `@namera-ai/sdk/browser` | browsers: non-extractable P-256 keys in IndexedDB     |

`SessionKey.ecdsaThreshold({ threshold, signers })` makes a k-of-n session key of up to 69 signers.
`SessionKey.passkey({ publicKey })` (and `passkeyThreshold`, up to 16 passkeys) makes a passkey session key, checked by
`WebAuthnValidator` from the session's own config.
Failures are `KeystoreError` and `SessionKeyError`.

## Sessions and policies

A session is a signer, a time window and a list of policies. Building one does no I/O; everything a session allows
or limits is a `Policy`, deny by default.

```ts
import { Policy, Session, SessionKey } from "@namera-ai/sdk"

const session = Session.from({
  signer: SessionKey.ecdsa(agentAddress),
  validUntil: Session.expiresIn({ days: 7 }),
  policies: [
    Policy.erc20Transfer({ token: USDC, to: [merchant], amount: { lte: 50_000000n } }),
    Policy.function({
      address: router,
      abi: routerAbi,
      functionName: "exactInputSingle",
      args: { params: { recipient: owner } }
    }),
    Policy.spend({ token: USDC, amount: 200_000000n, period: "day" }),
    Policy.rateLimit({ count: 20, period: "hour" }),
    Policy.gas({ maxCost: parseEther("0.01"), period: "day" }) // every session needs one
  ]
})

Session.validate(session) // { ok, problems, warnings }, each with a stable code
Session.describe(session) // plain-language lines for a confirmation screen
Session.toSmartSession(session) // Smart Sessions' Session struct, for enableSessions
```

| Kind      | Builders                                                                           |
| --------- | ---------------------------------------------------------------------------------- |
| Calls     | `function`, `erc20Transfer`, `erc20Approve`, `nativeTransfer`, `call`, `anyCall`   |
| Limits    | `spend`, `value`, `rateLimit`, `gas`, `approvals` (per `"hour"` … `"lifetime"`)    |
| Signing   | `signTypedData` (conditions on message fields, enforced on chain)                  |
| Execution | `execution` (an `IExecutionPolicy` contract, run by SessionHook around every call) |
| Other     | `custom` (any `IPolicy` contract)                                                  |

Conditions are plain values: `x` (equal), `[a, b]` (one of), `{ lte }`, `{ lt }`, `{ gte }`, `{ gt }`,
`{ between: [low, high] }`. `Policy.function` infers its `args` from a `const` ABI; conditions apply to static
arguments and static struct fields. `Session.from` throws `SessionError` (`InvalidSession`) listing every malformed
part; `Session.validate` reports errors such as `GAS_LIMIT_REQUIRED`, `NO_CALL_POLICY`, `OVERLAPPING_CALLS`,
`CONFLICTING_LIMITS`, `DUPLICATE_POLICY`, `EXECUTION_WITHOUT_LIMITS` (execution policies need `Policy.rateLimit` and
`Policy.gas`) and `SIGNS_FOR_ACCOUNT`, and warnings such as `UNRESTRICTED_AMOUNT_ARG`, `ANY_CALL` and `LONG_SESSION`.
`Policy.signMessage` is refused: Smart Sessions can't check personal messages.

What the policies enforce, and where they stop:

- **Gas.** The agent sets each operation's fees, and without a paymaster the account pays them, up to its whole
  balance, to whoever bundles the operation. A sponsored session's agent can simply leave the paymaster out, so every
  session needs `Policy.gas` (`GAS_LIMIT_REQUIRED`).
- **`Policy.anyCall`** reaches any contract but the account's own infrastructure: the account itself, Smart Sessions,
  the EntryPoint (its deposit), and the validators, executors and hooks the account has installed (they take the
  account's calls as configuration, so a call there could replace its owner). Those need an explicit policy.
- **`Policy.spend`** counts `transfer`, `transferFrom` and approvals (`approve`, `increaseAllowance`, and Permit2's
  `approve` of the token) and refuses any other function of a limited token, which it can't measure. It doesn't see
  tokens a contract pulls with an allowance given before the session; an execution policy measuring balances does.
- **`Policy.approvals`** caps `approve` per token (one cap, or `{ [token]: cap }` for tokens with different decimals),
  only to the listed spenders, and refuses `increaseAllowance`, whose calls would add up past the cap.
- **Arguments** are compared as whole words, so a lower bound on a narrow integer (`uint24 fee: { gte }`) also caps the
  word at the type's range.
- **Signing caps** (`Policy.signTypedData`) apply to each signature; there is no running total across signatures.

## Grants

A grant lets one agent use one session on one account, on one or more chains. The owner signs; nothing is sent, and
the agent's first operation on each chain enables the session there (Smart Sessions' ENABLE mode).

```ts
import { Grant } from "@namera-ai/sdk"

const grant = await Grant.create({ account, session }) // the owner signs through the account
const token = Grant.serialize(grant, { format: "token" }) // "nmr1_…", for a link or a QR code
await Grant.verify(client, Grant.parse(token)) // digests and the owner's signature

// The same account on two chains: one grant, signed once per chain
const multichain = await Grant.create({ account: [accountOnBase, accountOnOptimism], session })

// For an external signer: prepare, sign the typed data, assemble
const prepared = await Grant.prepare({ account, session })
const signed = Grant.from({ ...prepared, signature: await account.signTypedData(prepared.typedData) })

// Or enable it on chain now, from the owner
const { grant: installed } = await Grant.installSync(ownerBundler, { session })
```

A multichain grant takes one owner signature per chain: Kernel's ERC-1271 domain binds the chain, and so does
WebAuthnValidator's for passkey owners.

A grant is plain data and never holds a secret: the session (with the agent's public keys), the account's type and
deployment, and per chain the contracts, the enable nonce, the session digest and the owner's signature. JSON is
canonical; the token is the JSON compressed with FastLZ in base64url. `Grant.parse` refuses unknown fields and
versions (`GrantError`: `Malformed`, `VersionUnsupported`); `Grant.verify` refuses altered sessions (`DigestMismatch`)
and signatures the account doesn't accept (`InvalidSignature`, checked with ERC-6492 while undeployed).

## The agent

`Grant.toAccount` gives the agent a viem smart account at the owner's account address, signed by the session key. It
works with viem's own tooling:

```ts
import { Grant } from "@namera-ai/sdk"
import { createBundlerClient } from "viem/account-abstraction"

const agent = await Grant.toAccount(client, { grant: Grant.parse(token), signer: sessionKey })
const bundler = createBundlerClient({ account: agent, client, transport: http(bundlerUrl) })

const hash = await bundler.sendUserOperation({ calls }) // the first one enables the session (and deploys the account)
await bundler.waitForUserOperationReceipt({ hash })

const signature = await agent.signTypedData(permit) // an ERC-7739 session signature, where a signing policy allows it

// Lanes send in parallel, each with its own nonce (2^16 lanes)
const lanes = await Promise.all(
  [0, 1, 2, 3].map((lane) => Grant.toAccount(client, { grant, signer: sessionKey, lane }))
)

// A dry run without a key: the same policy check, and a simulation once the account is deployed
await Grant.check(client, { grant, calls }) // { ok, violations, simulation }
```

The signer is a viem local account for an ECDSA session key (several for a threshold), or a viem WebAuthn account for
a passkey session key; any other refuses with `GrantError` (`SignerMismatch`). The session key signs each user operation hash, and each
ERC-7739 nested digest, bound to the grant's permission id (`keccak256(abi.encode(hash, permissionId))`), as Smart
Sessions verifies it, so a signature can't be replayed under another session of the same key.

Before the session key signs, every operation and signature is checked against the session's policies, with the
limits' usage read from the chain: a violation rejects with `PolicyViolationError` (`CallNotAllowed`,
`ArgumentRejected`, `SpendLimitExceeded` with what is left and when it resets, `RateLimited`, `SignatureNotAllowed`,
`SessionExpired`, …) instead of sending an operation that would revert. `check: false` skips it. The check is advisory:
the contracts decide, and two lanes can each pass it and together exceed a budget, in which case one operation fails
validation. Custom and execution policies are left to the chain.

- **Signatures** need the session enabled on the chain (the agent's first operation, or `Grant.install`). The
  account accepts one when the typed data's verifying contract asks it, as a token's `permit` does. viem's
  `verifyTypedData` asks from its own validator contract, which a signing policy doesn't name, so it returns `false`.
  `signMessage` isn't supported: Smart Sessions verifies typed data only.
- **Deploying in the first operation** works on bundlers that enforce ERC-7562: Kernel deploys through ZeroDev's
  staked FactoryStaker.
- **Lanes**: send the first operation, which enables the session, on one lane before using others.

## After a grant

The owner revokes or updates a grant with owner operations through its bundler client (one per chain for a
multichain grant); anyone reads its status, limits and history without a key.

```ts
await Grant.revoke(ownerBundler, { grant }) // → hash, or undefined when it is already revoked
await Grant.revoke([ownerOnBase, ownerOnOptimism], { grant }) // every chain
Grant.revokeCalls(grant) // → the call, to batch yourself

const { grant: updated } = await Grant.update(ownerBundler, {
  grant,
  remove: [oldLimit],
  add: [Policy.rateLimit({ count: 5, period: "hour" })]
})

await Grant.getStatus(client, { grant }) // { state, validAfter, validUntil, chains, limits }
await Grant.getRemainingLimit(client, { grant, token: USDC }) // { remaining, resetsAt }
await Grant.getUsage(client, { grant, fromBlock }) // operations sent under it
await Grant.list(client, { account, grants }) // sessions enabled on the account
const watcher = Grant.watchStatus(client, { grant, onChange: (status) => console.log(status.state) })
watcher.off()
```

| State            | When                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| `pending-enable` | not enabled yet, and the grant can still enable it                        |
| `active`         | enabled, within its window                                                |
| `not-yet-valid`  | before its window                                                         |
| `expired`        | after its window                                                          |
| `revoked`        | removed, or its enable signature spent (an unused grant that was revoked) |

- **Revoking** removes an enabled session, or revokes an unused grant's enable signature so a leaked grant can never
  be enabled; revoking again sends nothing.
- **At most 127 enabled sessions** per account: Smart Sessions keeps each set (sessions per account, and per session
  its actions and each list of policies) within the storage ERC-7562 associates with the account. An expired grant
  still holds its place until revoked, so revoke expired grants.
- **Updating** keeps the permission id and what the limits have used, validates the updated session first, and
  spends the old enable signature, so the old grant can't bring the old policies back. The updated grant is
  installed: it carries no enable signature, and its agent uses the session as it is. Removing a call policy while
  `Policy.anyCall` stays is refused (`GrantError` `RemovalWidens`): the call would go through `anyCall` without the
  removed policy's conditions.
- **History** comes from the EntryPoint's logs, read in pages: pass `fromBlock` (the block the grant was created in)
  on a long chain. Smart Sessions stores permission ids, not sessions, so `Grant.list` matches ids to the grants you
  pass and marks the rest `foreign`.

## Bundlers and paymasters

`Bundler.*` and `Paymaster.*` return viem configuration, spread into viem's own `createBundlerClient`. There is no
Namera client.

```ts
import { Bundler, Paymaster } from "@namera-ai/sdk"
import { createBundlerClient } from "viem/account-abstraction"

const bundler = createBundlerClient({
  account, // an owner's account, or an agent's from Grant.toAccount
  client,
  ...Bundler.pimlico({ apiKey }), // → { transport, userOperation: { estimateFeesPerGas } }
  paymaster: Paymaster.circle({ token: "USDC" }) // → a viem paymaster
})
```

Recommended setups:

- **Bundler:** Pimlico (`Bundler.pimlico`) or Alchemy (`Bundler.alchemy`).
- **Sponsorship:** Circle (`Paymaster.circle`, gas paid in USDC) or Alchemy's Gas Manager (`Paymaster.alchemy`). Both
  work with any bundler, except Alchemy's with Candide's on Base Sepolia.
- **Pimlico's paymaster only through Pimlico's or ZeroDev's bundler:** its contract refuses other bundlers
  (`BundlerNotAllowed`), and so do ZeroDev's sponsorship and Pimlico's ERC-20 paymaster, which use the same contract.

| Bundlers                                       | Paymasters                                        |
| ---------------------------------------------- | ------------------------------------------------- |
| `Bundler.pimlico({ apiKey })`                  | `Paymaster.pimlico({ apiKey, policyId? })`        |
| `Bundler.alchemy({ apiKey, sponsorship? })`    | `Paymaster.pimlicoErc20({ apiKey, token })`       |
| `Bundler.candide({ apiKey? })`                 | `Paymaster.alchemy({ apiKey, policyId })`         |
| `Bundler.zerodev({ projectId, sponsorship? })` | `Paymaster.candide({ apiKey?, policyId })`        |
| `Bundler.etherspot({ apiKey })`                | `Paymaster.zerodev({ projectId })`                |
| `Bundler.from({ url })`                        | `Paymaster.etherspot({ apiKey, policyId? })`      |
|                                                | `Paymaster.circle({ token: "USDC", maxAmount? })` |
|                                                | `Paymaster.erc7677({ url, context })`             |

What the helpers handle:

- **Endpoints** for the client's chain, and **fees** from the bundler that submits, through its own method
  (`pimlico_getUserOperationGasPrice`, `zd_getUserOperationGasPrice`, Alchemy's `rundler_maxPriorityFeePerGas`,
  Candide's `voltaire_feesPerGas`, Etherspot's `skandha_getGasPrice`; the node's fees for `Bundler.from`).
- **Vendor quirks:** paymaster gas Candide's bundler doesn't estimate is filled in (150k verification), its tight
  verification estimate gets 5,000 gas more, Candide's paymaster gets at least 30k call gas (or the minimum it names),
  and Alchemy's bundler sponsorship (`sponsorship: { policyId }`) and ZeroDev's UltraRelay
  (`sponsorship: "ultra-relay"`) send zero fees and no paymaster.
- **Paymaster fields are never changed after the paymaster signs them**, and stub requests send zeroed gas.
- **Circle** builds its USDC permit itself: the owner's account signs it for owner operations, and the session key for
  an agent's, which needs the session to allow it (`Policy.signTypedData` of USDC's `Permit` with Circle's paymaster
  as spender). Its EntryPoint 0.7 paymaster works on Base, Base Sepolia and Arbitrum Sepolia; the Sepolia one is
  unfunded.
- **API keys never appear in errors**: bundler and paymaster failures become `BundlerError`, `PaymasterError` or
  `CompatError` without the endpoint's credentials.

### Combinations

`Compat.check` knows which combinations work, from Namera's live tests; `Compat.matrix()` is the whole table, with a
source and date per rule. The bundler helpers run it when viem prepares each operation (their fee hook is where the
account, the bundler and the paymaster meet), and refuse a combination with problems with `CompatError` before
anything is signed. Pass `strict: false` to a bundler helper to send anyway.

```ts
Compat.check({ account, bundler: "candide", paymaster: "pimlico", chainId: base.id })
// → { ok: false, problems: [{ code: "PAYMASTER_BUNDLER_BOUND", message: "…" }], warnings: [] }
```

| Rule                                                                                                           | Code                          |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Pimlico's and ZeroDev's sponsorship and Pimlico's ERC-20 paymaster only through Pimlico's or ZeroDev's bundler | `PAYMASTER_BUNDLER_BOUND`     |
| Alchemy's Gas Manager refuses Candide's bundler on Base Sepolia                                                | `PAYMASTER_BUNDLER_BOUND`     |
| Etherspot's Arka sponsors owner operations only, not agents'                                                   | `PAYMASTER_AGENT_UNSUPPORTED` |
| Alchemy's bundler sponsorship only through Alchemy, UltraRelay only through ZeroDev, neither with a paymaster  | `SPONSORSHIP_BUNDLER_BOUND`   |
| Etherspot's EntryPoint 0.7 endpoint rejects EIP-7702 authorizations (until the account is delegated)           | `EIP7702_UNSUPPORTED`         |
| Etherspot includes operations in about 95 s: raise `waitForUserOperationReceipt`'s timeout                     | warning `SLOW_INCLUSION`      |
| Circle's paymaster for an agent needs a session that allows its permit                                         | `SESSION_PERMIT_REQUIRED`     |
| The bundler, paymaster or Namera's session contracts are not on the chain                                      | `NOT_ON_CHAIN`                |

`Session.validate(session, { paymaster, chainId })` warns `SESSION_PERMIT_REQUIRED` too, before the owner signs the
grant.

## The Effect API

`@namera-ai/sdk/effect` has the same modules, names and options as the Promise API (without `signal`: interrupt the
fiber instead). Every asynchronous function returns an `Effect<A, E, never>` that fails with the same error instances,
and pure functions and error classes are the same values in both. Errors are tagged, with a tagged `reason`:

```ts
import { Grant } from "@namera-ai/sdk/effect"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const grant = yield* Grant.create({ account, session })
  return yield* Grant.getStatus(client, { grant })
}).pipe(
  Effect.catchTag("SessionError", (error) => Effect.die(error.reason.problems)),
  Effect.catchReason("ChainError", "Timeout", () => Effect.succeed(undefined))
)
```

Services exist only in the Effect API. `Keystore.CurrentKeystore` carries the program's key store, so it is chosen
once where the program is assembled:

| Layer                                                   | Store                    |
| ------------------------------------------------------- | ------------------------ |
| `Keystore.layer(store)`                                 | the given store          |
| `Keystore.layerMemory`                                  | a new in-memory store    |
| `Keystore.layerEncryptedJson({ password, data? })`      | an `encryptedJson` store |
| `Keystore.layerFile(options)` (`/effect/node`)          | a `file` store           |
| `Keystore.layerOsKeychain(options)` (`/effect/node`)    | the OS keychain          |
| `Keystore.layerWebCrypto(options?)` (`/effect/browser`) | a WebCrypto store        |

```ts
import { Keystore } from "@namera-ai/sdk/effect"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const store = yield* Keystore.CurrentKeystore
  return yield* Keystore.create(store, { curve: "secp256k1" })
})

await Effect.runPromise(program.pipe(Effect.provide(Keystore.layerMemory)))
```

Precedence: where an API accepts both an option and a service for the same thing, the service in context wins.

## OpenTelemetry

`@namera-ai/sdk/otel` sends Namera's spans to the app's OpenTelemetry tracer provider (the global one, registered by
the app or the OpenTelemetry Node SDK). It needs the optional peers `@effect/opentelemetry` and `@opentelemetry/api`.

```ts
import { Otel } from "@namera-ai/sdk/otel"

Otel.install() // the Promise API; returns a function that uninstalls it

const traced = program.pipe(Effect.provide(Otel.layer)) // the Effect API
```

- Spans are named `Namera.<Module>.<function>` (`Namera.Grant.create`, `Namera.Grant.getStatus`,
  `Namera.SmartAccount.addOwnerSync`, `Namera.KernelAccount.from`, …) and nest under the span active where the call
  was made: the app's OpenTelemetry span, or the Effect program's span.
- Attributes: `namera.chain.id` (the chain, or the chains of a call on several), `namera.account.type` and
  `namera.grant.id` where they apply. Never keys, signatures, addresses or endpoint URLs.
- Failures are recorded with URLs redacted from the message and the stack, including the viem error a `ChainError`
  keeps as its cause, whose message has the request URL and any API key in it.
- Until `./otel` is used, Namera creates no spans and bundles none of Effect's span code (about 4.4 KB gzip).
- The tracer in an Effect program's context wins: `Otel.install()` affects only the Promise API.

## The viem decorator

`client.extend(nameraActions())` puts the network functions under one namespace, `client.namera`, bound to the client.
Each method calls the standalone function (`client.namera.grant.getStatus({ grant })` is
`Grant.getStatus(client, { grant })`), so the two are interchangeable, and viem's own actions are untouched.

```ts
import { nameraActions } from "@namera-ai/sdk/decorators"
import { createPublicClient, http } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { base } from "viem/chains"

const client = createPublicClient({ chain: base, transport: http() }).extend(nameraActions())
await client.namera.grant.getStatus({ grant })
await client.namera.account.detect({ address })

const owner = createBundlerClient({ account, client, transport: http(bundlerUrl) }).extend(nameraActions())
await owner.namera.grant.revokeSync({ grant })
await owner.namera.account.installSessions()
```

A public client gets the reads (`grant`: `create`, `prepare`, `verify`, `toAccount`, `check`, `getStatus`,
`getRemainingLimit`, `isEnabled`, `getUsage`, `list`, `watchStatus`; `account`: `detect`, `isSessionsInstalled`,
`getOwners`). A bundler client also gets the owner operations (`grant.install`, `revoke`, `update` and their `*Sync`
forms; `account.installSessions`, `addOwner`, `removeOwner`, `setThreshold`, `replaceOwner`, `addOwnerValidator` and
theirs); on a public client they are a type error.

## Errors

Each failure family is one error class with a tagged `reason` (`ChainError` with `Transport`, `Rpc`, `Reverted` or
`Timeout`; `AccountError` with `NotSupported`, `SigningFailed`, …), handled with `Effect.catchTag` and
`Effect.catchReason` in the Effect API. Every error carries viem's error fields (`shortMessage`, `details`,
`metaMessages`, `version`); `metaMessages` names where it happened (method, chain, endpoint) and ends with a hint.
Raw viem and ox errors are translated into a Namera error with the original kept as the cause. Endpoints never show
credentials: user info, the query and key-like path segments are removed.

`NameraError.decode(error)` turns a failed viem call into the Namera error it stands for: Smart Sessions' reverts into
`PolicyViolationError` where the revert says enough, the paymaster allowlist's `BundlerNotAllowed` into
`PaymasterError` (`BundlerBound`), vendors' JSON-RPC errors (an inactive policy, too little balance) into
`PaymasterError`, and EntryPoint codes into `BundlerError` (`Rejected` with `aa` and the decoded revert).

```ts
import { ChainError, NameraError } from "@namera-ai/sdk"

try {
  // …
} catch (error) {
  if (error instanceof ChainError.ChainError && error.reason._tag === "Rpc") console.log(error.reason.code)
  if (NameraError.isNameraError(error)) console.log(error.shortMessage)
}
```

### Sending errors to another process

`NameraError.toJSON(error)` writes an error as plain, versioned JSON (`format: 1`) for an EIP-1193 provider's error
`data`, an agent tool's result or a worker's message; `NameraError.fromJSON(json)` rebuilds it as the same family and
reason classes, so `instanceof`, `NameraError.isNameraError`, the family guards and `Effect.catchReason` work on the
other side.

```ts
import { ChainError, NameraError } from "@namera-ai/sdk"

const json = JSON.stringify(NameraError.toJSON(error)) // in the worker

const received = NameraError.fromJSON(JSON.parse(json)) // in the app
if (received instanceof ChainError.ChainError && received.reason._tag === "Rpc") console.log(received.reason.code)
```

- The JSON holds the family's `_tag` and fields, the reason's `_tag` and fields (every violation, for a
  `PolicyViolationError`), bigints as `{ "$n": "<decimal>" }`, and viem's error fields for readers without the SDK.
- A reason's `cause` is reduced to `{ name, message }` (the cause's `shortMessage`, URLs redacted): viem's full message
  holds the request body and URL, so it, the stack and the cause's fields never leave. `fromJSON` rebuilds the cause as
  an `Error` with that name and message.
- Only the fields Namera's errors declare are written, URLs are redacted in every string, and no key or signature is
  among them.
- `fromJSON` reads strictly and throws `SerializationError`: `Malformed` for anything that isn't a serialized error
  (an unknown family or reason, a missing, mistyped or unknown field), `VersionUnsupported` for a format other than 1.
  The Effect API's `NameraError.fromJSON` fails with it instead.

## Development

`src/` follows the Effect v4 source layout: PascalCase public modules, `internal/` implementation, and an `effect/`
tree mirroring the Promise tree. Barrels, the exports maps and `src/internal/version.ts` are generated by
`pnpm codegen`; never edit them by hand. Unit tests need no chain; `*.chain.test.ts` run against the private
`@namera-ai/devnet` package. The live bundler and paymaster matrix runs by hand against real testnets and vendors
(`pnpm test:live`); see [`test/live/README.md`](./test/live/README.md).

## License

[Apache-2.0](./LICENSE)
