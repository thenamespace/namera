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
