# @namera-ai/sdk

Scoped, revocable session keys for agents on ERC-7579 smart accounts, built on viem.

> Version 2 is a rewrite and is in development. It is not compatible with 1.x, and nothing in it is released yet.

## Install

```sh
pnpm add @namera-ai/sdk viem effect
```

## Entry points

| Entry                   | What it exports                                                               |
| ----------------------- | ----------------------------------------------------------------------------- |
| `@namera-ai/sdk`        | The Promise API: `Session`, `NameraError`, `ChainError`, …                    |
| `@namera-ai/sdk/effect` | The same modules and names, with asynchronous functions returning an `Effect` |

Every module is also importable on its own (`@namera-ai/sdk/Session`).

## Accounts

Every account is viem's `SmartAccount`, so viem's bundler client, paymasters and wagmi use it unchanged.
`KernelAccount.from` (Kernel 3.3), `NexusAccount.from` (Nexus 1.3.3) and `Safe7579Account.from` (Safe 1.4.1 with
Safe7579 v2) are built on `SmartAccount.from`, which takes viem's `toSmartAccount` options. New accounts install Smart
Sessions in their deploying operation unless `sessions: false`.

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
const existing = await SmartAccount.fromAddress({ client, address, owner }) // an account another SDK created
```

`KernelAccount.fromEip7702` and `NexusAccount.fromEip7702` use the owner's own address. As with any viem EIP-7702
account, the first user operation carries the owner's signed authorization:

```ts
import { signAuthorization } from "viem/actions"

const account = await KernelAccount.fromEip7702({ client, owner })
const authorization = await signAuthorization(client, account.authorization!)
await bundler.sendUserOperation({ calls, authorization })
```

### Passkey owners

A passkey (viem's `WebAuthnAccount`) can own a Kernel, Nexus or Safe7579 account. It verifies through Namera's
`WebAuthnValidator`, with the P-256 precompile where the chain has one, and its ERC-1271 signatures are bound to the
account and chain:

```ts
import { toWebAuthnAccount } from "viem/account-abstraction"

const owner = toWebAuthnAccount({ credential })
const account = await KernelAccount.from({ client, owner })

// Up to 16 passkeys, two of which sign each operation.
const shared = await NexusAccount.from({ client, owner: { passkeys: [laptop, phone, key], threshold: 2 } })
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

Kernel and Nexus hold one key, which `replaceOwner` rotates; a Safe7579 account's keys change on OwnableValidator and on
the Safe itself together. Changes that would leave fewer owners than the threshold are refused before sending.

Nexus and Safe7579 accounts deploy through unstaked factories, so bundlers that enforce ERC-7562 refuse to deploy
them in their first user operation; hosted bundlers accept it, and the error's hint says so.

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

`SessionKey.ecdsaThreshold({ threshold, signers })` makes a k-of-n session key. `SessionKey.passkey({ publicKey })`
(and `passkeyThreshold`) makes a passkey session key, checked by `WebAuthnValidator` from the session's own config.
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
    Policy.rateLimit({ count: 20, period: "hour" })
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
part; `Session.validate` reports errors such as `NO_CALL_POLICY`, `OVERLAPPING_CALLS`, `CONFLICTING_LIMITS`,
`EXECUTION_WITHOUT_LIMITS` (execution policies need `Policy.rateLimit` and `Policy.gas`) and `SIGNS_FOR_ACCOUNT`, and
warnings such as `UNRESTRICTED_AMOUNT_ARG`, `ANY_CALL` and `LONG_SESSION`. `Policy.signMessage` is refused: Smart
Sessions can't check personal messages.

## Grants

A grant lets one agent use one session on one account, on one or more chains. The owner signs; nothing is sent, and
the agent's first operation on each chain enables the session there (Smart Sessions' ENABLE mode).

```ts
import { Grant } from "@namera-ai/sdk"

const grant = await Grant.create({ account, session }) // the owner signs through the account
const token = Grant.serialize(grant, { format: "token" }) // "nmr1_…", for a link or a QR code
await Grant.verify(client, Grant.parse(token)) // digests and the owner's signature

// The same account on two chains: one grant, signed once where the account allows it
const multichain = await Grant.create({ account: [accountOnBase, accountOnOptimism], session })

// For an external signer: prepare, sign the typed data, assemble
const prepared = await Grant.prepare({ account, session })
const signed = Grant.from({ ...prepared, signature: await account.signTypedData(prepared.typedData) })

// Or enable it on chain now, from the owner
const { grant: installed } = await Grant.installSync(ownerBundler, { session })
```

| Account               | Signatures for a multichain grant                           |
| --------------------- | ----------------------------------------------------------- |
| Safe7579, key owners  | one: OwnableValidator checks the raw digest                 |
| Kernel, Nexus         | one per chain: their ERC-1271 domain binds the chain        |
| Any account, passkeys | one per chain: WebAuthnValidator's ERC-1271 binds the chain |

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

// Lanes send in parallel, each with its own nonce (Kernel 2^16 lanes, Nexus 2^24, Safe7579 2^32)
const lanes = await Promise.all(
  [0, 1, 2, 3].map((lane) => Grant.toAccount(client, { grant, signer: sessionKey, lane }))
)

// A dry run without a key: the same policy check, and a simulation once the account is deployed
await Grant.check(client, { grant, calls }) // { ok, violations, simulation }
```

The signer is a viem local account for an ECDSA session key (several for a threshold), or a viem WebAuthn account for
a passkey session key; any other refuses with `GrantError` (`SignerMismatch`).

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
- **Deploying in the first operation** works where the account's factory is staked (Kernel, through ZeroDev's
  FactoryStaker). Nexus's and Safe7579's factories are unstaked, so a bundler that enforces ERC-7562 refuses it there:
  deploy those accounts first.
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
- **Updating** keeps the permission id and what the limits have used, validates the updated session first, and
  revokes the old enable signature, so the old grant can't bring the old policies back. The updated grant is
  installed: it carries no enable signature, and its agent uses the session as it is.
- **History** comes from the EntryPoint's logs, read in pages: pass `fromBlock` (the block the grant was created in)
  on a long chain. Smart Sessions stores permission ids, not sessions, so `Grant.list` matches ids to the grants you
  pass and marks the rest `foreign`.

## Errors

Each failure family is one error class with a tagged `reason` (`ChainError` with `Transport`, `Rpc`, `Reverted` or
`Timeout`; `AccountError` with `NotSupported`, `SigningFailed`, …), handled with `Effect.catchTag` and
`Effect.catchReason` in the Effect API. Every error carries viem's error fields (`shortMessage`, `details`,
`metaMessages`, `version`); `metaMessages` names where it happened (method, chain, endpoint) and ends with a hint.
Raw viem and ox errors are translated into a Namera error with the original kept as the cause. Endpoints never show
credentials: user info, the query and key-like path segments are removed.

```ts
import { ChainError, NameraError } from "@namera-ai/sdk"

try {
  // …
} catch (error) {
  if (error instanceof ChainError.ChainError && error.reason._tag === "Rpc") console.log(error.reason.code)
  if (NameraError.isNameraError(error)) console.log(error.shortMessage)
}
```

## Development

`src/` follows the Effect v4 source layout: PascalCase public modules, `internal/` implementation, and an `effect/`
tree mirroring the Promise tree. Barrels, the exports maps and `src/internal/version.ts` are generated by
`pnpm codegen`; never edit them by hand. Unit tests need no chain; `*.chain.test.ts` run against the private
`@namera-ai/devnet` package.

## License

[Apache-2.0](./LICENSE)
