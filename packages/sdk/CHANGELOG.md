# @namera-ai/sdk

## 2.0.0-rc.0

### Major Changes

- Namera v2: a rewrite on viem and Effect, with no compatibility with 1.x. This is a release candidate, and the
  contracts it uses are unaudited (internal security reviews only).
  
  - **One account:** Kernel 3.3 on EntryPoint 0.7, deployed through its factory or on an EOA through EIP-7702. Namera's
    contracts are deployed on Base, Sepolia, Base Sepolia, Arbitrum Sepolia and OP Sepolia.
  - **Two mirrored APIs:** the Promise API (`@namera-ai/sdk`) and the Effect API (`@namera-ai/sdk/effect`), with every
    module also importable on its own (`@namera-ai/sdk/Grant`), plus the `./node`, `./browser`, `./decorators` and
    `./otel` entries. `effect` (^4.1.5) and `viem` (^2.58.4) are peers. The SDK depends on the exact `ox` its viem
    uses (0.14.67), so an app bundles one ox: upgrade viem and the SDK together.
  - **Errors:** one `Data.TaggedError` class per failure family, with a tagged `reason`: `ChainError`, `AccountError`,
    `SessionError`, `GrantError`, `PolicyViolationError`, `KeystoreError`, `SessionKeyError`, `BundlerError`,
    `PaymasterError`, `CompatError` and `SerializationError`. Each carries viem's error fields, where it happened
    (`ChainError` has `method`, `chainId` and `url`) and a hint, never an endpoint's credentials. Raw viem and ox errors
    become a `ChainError` with the original as the `cause`. `NameraError` holds the union, `isNameraError` (safe across
    duplicate copies of the package) and `decode`.
  - `Session.now()` returns the current time in the seconds sessions use; the Effect form reads `Clock`.

### Minor Changes

- Policies and sessions. `Policy.*` builders cover calls with conditions inferred from the ABI (`call`,
  `erc20Transfer`, `erc20Approve`, `nativeTransfer`, `anyCall`), spend, value, rate and gas limits, `approvals` with a
  cap per token, typed-data signing with field conditions, execution policies and custom policies. `Session.from`,
  `Session.expiresIn`, `Session.validate` (every problem with a stable code), `Session.describe`,
  `Session.getPermissionId` and `Session.toSmartSession`, which compiles a session to Namera's contracts. Failures are
  `SessionError` (`InvalidSession`).
  
  - Every session needs `Policy.gas` (`GAS_LIMIT_REQUIRED`): the agent sets the fees, which the account pays without a
    paymaster.
  - `Policy.spend` always counts approvals of its token, so approving then pulling can't bypass the budget.
  - A lower bound on an integer narrower than 256 bits also caps the word at the type's range.
  - `Session.validate` refuses a policy listed twice (`DUPLICATE_POLICY`). Given `paymaster` and `chainId`, it warns
    `SESSION_PERMIT_REQUIRED` for Circle's paymaster without a permit policy.

- Keys and session keys for agents.
  
  - `Key`: a key's public half, with its addresses per chain namespace (`Key.address`, `Key.caip10`; `eip155` now,
    `tron` and `solana` reserved).
  - `Keystore`: stores that hold keys by curve (secp256k1, ed25519, p256) and sign inside the store. `memory`,
    `encryptedJson` (exported with `toJson`) and `from` (your own backend) work everywhere; `Keystore.file` and
    `Keystore.osKeychain` (with the optional peer `@napi-rs/keyring`) are in `@namera-ai/sdk/node`, and
    `Keystore.webCrypto` in `@namera-ai/sdk/browser`. `Keystore.toAccount` turns a secp256k1 key into a viem account.
  - The Effect API's `Keystore.CurrentKeystore` service carries a key store through a program's context:
    `Keystore.layer(store)`, `layerMemory` and `layerEncryptedJson(options)`, with `layerFile` and `layerOsKeychain` in
    `@namera-ai/sdk/effect/node` and `layerWebCrypto` in `@namera-ai/sdk/effect/browser`. Where an API takes both a
    store option and the service, the service wins.
  - `SessionKey.ecdsa` and `SessionKey.ecdsaThreshold` (up to 69 signers), checked by `ECDSASessionValidator`, and
    `SessionKey.passkey` and `SessionKey.passkeyThreshold` (up to 16 passkeys), checked by `WebAuthnValidator` from the
    session's own config; `SessionKey.toValidatorData`.
  - Failures are `KeystoreError` and `SessionKeyError`.

- Kernel 3.3 accounts as viem `SmartAccount`s: `KernelAccount.from`, and `KernelAccount.fromEip7702` for an EOA
  delegated to Kernel, built on `SmartAccount.from`, which takes viem's `toSmartAccount` options.
  
  - Owners are local keys, JSON-RPC wallets or passkeys (viem's `WebAuthnAccount`, through Namera's `WebAuthnValidator`):
    one, or `{ passkeys, threshold }` for up to 16 passkeys of which `threshold` sign each operation.
    `SmartAccount.signUserOperations` signs user operations on several chains with one prompt per passkey, prepared with
    `SmartAccount.getMultichainStubSignature`.
  - New accounts install Smart Sessions and SessionHook in their deploying operation (`sessions`, default `true`), and
    deploy through ZeroDev's FactoryStaker, which is staked in the EntryPoint, so bundlers that enforce ERC-7562 accept
    the deploying operation.
  - `SmartAccount.detect` reads whether an address holds a Kernel 3.3 account (deployed or through EIP-7702) and whether
    sessions are installed; any other account is `unsupported`. `SmartAccount.fromAddress` connects to Kernel accounts
    other SDKs created. `SmartAccount.installSessions`, `installSessionsSync`, `installSessionsCalls` and
    `isSessionsInstalled`.
  - Owners after creation: `SmartAccount.getOwners`, and `addOwner`, `removeOwner`, `setThreshold`, `replaceOwner` and
    `addOwnerValidator`, each also as `…Calls` to batch and `…Sync` to wait.
  - Failures are `AccountError` (`NotSupported`, `SessionsNotInstalled`, `SigningFailed`, `InvalidOptions`,
    `ChainMismatch`, `OwnerNotFound`, `OwnerExists`, `ThresholdUnreachable`, `OperationNotSupported`).

- Grants: a session the owner signed for an agent.
  
  - `Grant.create`, `prepare` and `from`: the owner signs the session's EIP-712 `MultiChainSession` through the account,
    once per chain (Kernel binds the chain in its ERC-1271 domain), and nothing is sent. `install` and `installSync`
    enable it on chain now; otherwise the agent's first operation does.
  - `Grant.verify` checks the session digests and the owner's signature (ERC-6492 for undeployed accounts).
    `serialize` and `parse` read and write canonical JSON or a compact `nmr1_` token, and `parse` refuses anything
    else, unknown fields included. `describe` lists what a grant allows.
  - After a grant: `revoke`, `revokeSync` and `revokeCalls` remove an enabled session, or revoke an unused grant's
    enable signature, on one chain or every chain. `update`, `updateSync` and `updateCalls` add and remove policies in
    place and revoke the old enable signature. Reads need no key: `getStatus`, `getRemainingLimit`, `isEnabled`,
    `getUsage` (operations from the EntryPoint's logs), `list` and `watchStatus`.
  - Failures are `GrantError` (`Malformed`, `VersionUnsupported`, `InvalidSignature`, `SignerMismatch`,
    `ChainNotCovered`, `DigestMismatch`, `PolicyNotFound`, `RemovalWidens`: removing a call policy while
    `Policy.anyCall` stays).

- `Grant.toAccount`: the agent's viem smart account under a grant. It sends user operations through viem's bundler
  client on 2^16 parallel nonce lanes (the first enables the session, and deploys the account when its factory allows
  it), and signs typed data with ERC-7739 session signatures bound to the session's permission id. Before the session
  key signs, each operation and signature is checked against the session's policies, with the limits' usage read from
  the chain, and a breach is refused with `PolicyViolationError` (`CallNotAllowed`, `ArgumentRejected`,
  `SpendLimitExceeded`, `SessionRevoked`, …). `Grant.check` runs the same check without a key.

- `Grant.toProvider({ grant, signer, client, bundler, paymaster? })` (and the Effect API's `Grant.toProvider`) wraps the
  agent's account in an EIP-1193 provider for wagmi, viem's `custom` transport and other wallet-expecting tools. It
  answers the account and chain, EIP-5792 2.0.0 (`wallet_sendCalls` as one atomic user operation, with ERC-7677
  `paymasterService` sponsorship through `Paymaster.erc7677`; `wallet_getCallsStatus` with 100 pending, 200 confirmed,
  400 dropped and 500 reverted; `wallet_getCapabilities`), `eth_signTypedData_v4` with session signatures, and forwards
  reads to the client's node. Anything that would sign or send otherwise is refused with 4200, and policy refusals are
  4100 with `NameraError.toJSON(error)` as `data`.

- Bundlers, paymasters and combinations, as viem configuration. `Bundler.pimlico`, `alchemy` (with Alchemy's bundler
  sponsorship), `candide`, `zerodev` (with UltraRelay), `etherspot` and `from` return `{ transport, userOperation }` for
  `createBundlerClient`: the vendor's endpoint for the client's chain, fees from the vendor's own method, and its
  estimate quirks. `Paymaster.pimlico`, `pimlicoErc20`, `alchemy`, `candide`, `zerodev`, `etherspot`, `circle` and
  `erc7677` return viem paymasters: stub requests with zeroed gas, missing paymaster gas filled in, signed fields never
  changed, and Circle's USDC permit signed by the account (the owner, or an agent's session key under a
  `Policy.signTypedData`).
  
  `Compat.check` and `Compat.matrix` hold the combination rules from Namera's live tests on Base Sepolia and Sepolia
  (`PAYMASTER_BUNDLER_BOUND`, `PAYMASTER_AGENT_UNSUPPORTED`, `SPONSORSHIP_BUNDLER_BOUND`, `EIP7702_UNSUPPORTED`,
  `SLOW_INCLUSION`, `SESSION_PERMIT_REQUIRED`, `NOT_ON_CHAIN`), and the bundler helpers refuse a combination that can't
  work with `CompatError` before signing (`strict: false` sends anyway). `NameraError.decode` turns bundler and
  paymaster failures into `PolicyViolationError`, `BundlerError` (`Rejected`, `Unsupported`, `Dropped`),
  `PaymasterError` (`Rejected`, `PolicyInactive`, `InsufficientBalance`, `BundlerBound`) and `CompatError`
  (`Incompatible`), with API keys kept out of every error.

- `@namera-ai/sdk/decorators`: `client.extend(nameraActions())` adds Namera's network functions under `client.namera`
  (`grant` and `account`), each bound to the client and forwarding to the standalone function. Public clients get the
  reads; bundler clients also get the owner operations (`grant.revoke`, `account.installSessions`, …), which are a type
  error on a public client. The decorator's types infer only whether the client has bundler actions, so decorating a
  client costs about 600 type instantiations.

- `@namera-ai/sdk/otel`: `Otel.install()` (Promise API) and `Otel.layer` (Effect API) send Namera's spans
  (`Namera.Grant.create`, `Namera.SmartAccount.detect`, …) to the app's global OpenTelemetry tracer provider, nested
  under the active span. Spans carry `namera.chain.id`, `namera.account.type` and `namera.grant.id`, never keys,
  signatures or URLs, and failures are recorded with URLs redacted, including those in a `ChainError`'s viem cause.
  `@effect/opentelemetry` and `@opentelemetry/api` are optional peers; without `./otel`, no span code is bundled.

- `NameraError.toJSON(error)` and `NameraError.fromJSON(json)` send errors across process boundaries: plain, versioned
  JSON (`format: 1`) with the family and reason tags and fields, a `{ name, message }` summary of the cause and viem's
  error fields, never keys, signatures or URLs with credentials; read back as the same family and reason classes, so
  `instanceof`, the guards and `Effect.catchReason` work on the other side. Input that isn't a serialized error fails with
  the new `SerializationError` (`Malformed`, `VersionUnsupported`), which joins the `NameraError` union.

### Patch Changes

- Updated dependencies [`6b33b78`, `6b33b78`, `6b33b78`, `6b33b78`]:
  - @namera-ai/contracts@2.0.0-rc.0
