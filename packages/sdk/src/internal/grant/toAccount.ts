import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as Address from "ox/Address"
import * as Hex from "ox/Hex"

import * as AccountError from "../../accounts/AccountError.ts"
import type * as ChainError from "../../ChainError.ts"
import * as GrantError from "../../GrantError.ts"
import * as PolicyViolationError from "../../PolicyViolationError.ts"
import * as WebAuthn from "../core/account/webauthn.ts"
import { decodeCalls, type DecodedCall, encodeCalls, statedTime } from "../core/agent/calls.ts"
import * as Erc7739 from "../core/agent/erc7739.ts"
import { isLane, lanes, nonceKey } from "../core/agent/nonce.ts"
import { ecdsaSignature, stubSignature } from "../core/agent/sessionSignature.ts"
import { evaluateOperation, gasCost } from "../core/evaluate/evaluate.ts"
import { evaluateSignature } from "../core/evaluate/signature.ts"
import { counters } from "../core/evaluate/usage.ts"
import type { Violation } from "../core/evaluate/violation.ts"
import { encodeEnableSignature, encodeUseSignature } from "../core/grant/enable.ts"
import * as core from "../core/grant/grant.ts"
import { compile } from "../core/session/compile.ts"
import type { EcdsaSessionKey, PasskeySessionKey } from "../core/sessionKey.ts"
import { run } from "../promise.ts"
import type { LocalAccount } from "../viem/account.ts"
import { call, type ChainClient, code, hasP256Precompile, latestTimestamp, type ReadClient } from "../viem/client.ts"
import { passkeySigner, type TypedDataDefinition, type WebAuthnAccount } from "../viem/signing.ts"
import {
  build,
  entryPoint,
  nonce,
  type SmartAccount,
  type SmartAccountImplementation,
  userOperationHash,
  type UserOperationToSign
} from "../viem/smartAccount.ts"
import { isEnabled, readState } from "./state.ts"

// The agent's account: a viem smart account at the owner's address that sends and signs through Smart Sessions under
// a grant. viem drives it through its hooks; the session lives in them (nonce lane, ENABLE then USE signatures, the
// stated time and SessionHook's tag in the calldata, ERC-7739 session signatures), and with `check` each operation and
// signature is evaluated against the session's policies before the session key signs.

/**
 * A session key signer: a viem local account for an ECDSA session key, a viem WebAuthn account for a passkey.
 */
export type Signer = LocalAccount | WebAuthnAccount

/**
 * What `Grant.toAccount` takes.
 *
 * @internal
 */
export interface Options {
  readonly grant: core.Grant
  readonly signer: Signer | ReadonlyArray<Signer>
  readonly lane?: number | undefined
  readonly check?: boolean | undefined
}

const ref = (grant: core.Grant): AccountError.Options["account"] => ({
  type: grant.accountType.type,
  address: core.accountAddress(grant)
})

const mismatch = (detail: string) => GrantError.make(new GrantError.SignerMismatch({ detail }))

const isWebAuthn = (signer: Signer): signer is WebAuthnAccount => signer.type === "webAuthn"

/** The session key's signers among `signers`: all of them must be the session's, at least its threshold. */
const selectSigners = (
  sessionKey: EcdsaSessionKey | PasskeySessionKey,
  signers: ReadonlyArray<Signer>
): Result.Result<ReadonlyArray<Signer>, GrantError.GrantError> => {
  const selected: Array<Signer> = []
  const seen = new Set<string>()
  for (const signer of signers) {
    if (sessionKey.type === "ecdsa") {
      if (isWebAuthn(signer)) return Result.fail(mismatch("the session key is ECDSA, and a passkey was given"))
      if (!sessionKey.signers.some((entry) => Address.isEqual(entry, signer.address))) {
        return Result.fail(mismatch(`${signer.address} is not one of the session key's signers`))
      }
      seen.add(signer.address.toLowerCase())
    } else {
      if (!isWebAuthn(signer)) return Result.fail(mismatch("the session key is a passkey, and an account was given"))
      const id = WebAuthn.credentialId(signer.publicKey)
      if (!sessionKey.passkeys.some((passkey) => WebAuthn.credentialId(passkey.publicKey) === id)) {
        return Result.fail(mismatch("the passkey is not one of the session key's passkeys"))
      }
      seen.add(id)
    }
    if (seen.size > selected.length) selected.push(signer)
  }
  if (selected.length < sessionKey.threshold) {
    return Result.fail(
      mismatch(`the session key needs ${sessionKey.threshold} signers, and ${selected.length} were given`)
    )
  }
  return Result.succeed(selected.slice(0, sessionKey.threshold))
}

/** The session key's signature of `hash`: ECDSA signatures in signer order, or passkey assertions. */
const signHash = (
  signers: ReadonlyArray<Signer>,
  options: { readonly precompile: boolean; readonly account: AccountError.Options["account"] }
) =>
(hash: Hex.Hex): Effect.Effect<Hex.Hex, AccountError.AccountError> => {
  const passkeys = signers.filter(isWebAuthn)
  if (passkeys.length > 0) {
    return Effect.forEach(passkeys, (passkey) => passkeySigner(passkey, options.account).sign(hash)).pipe(
      Effect.map((assertions) => WebAuthn.encodeSignature({ precompile: options.precompile, assertions }))
    )
  }
  return Effect.forEach(signers as ReadonlyArray<LocalAccount>, (signer) =>
    Effect.tryPromise({
      try: () => signer.signMessage({ message: { raw: hash } }),
      catch: (cause) => AccountError.signingFailed({ account: options.account, cause })
    }).pipe(Effect.map((signature) => ({ signature, signer: signer.address })))).pipe(Effect.map(ecdsaSignature))
}

const refuse = (violations: ReadonlyArray<Violation>): Effect.Effect<void, PolicyViolationError.PolicyViolationError> =>
  violations.length === 0
    ? Effect.void
    : Effect.fail(PolicyViolationError.make(violations as [Violation, ...Array<Violation>]))

/**
 * Builds the agent's account for a grant on the client's chain.
 *
 * @internal
 */
export const toAccount = Effect.fnUntraced(function*(
  client: ReadClient,
  options: Options
): Effect.fn.Return<SmartAccount, AccountError.AccountError | ChainError.ChainError | GrantError.GrantError> {
  const { grant } = options
  const account = ref(grant)
  if (client.chain === undefined) {
    return yield* AccountError.invalidOptions({ account, detail: "the client has no chain" })
  }
  const chainClient = client as ChainClient
  const chainId = client.chain.id
  const chain = grant.chains.find((entry) => core.chainId(entry.chain) === chainId)
  if (chain === undefined) return yield* GrantError.make(new GrantError.ChainNotCovered({ chain: core.caip2(chainId) }))

  const type = grant.accountType.type
  const lane = options.lane ?? 0
  if (!isLane(type, lane)) {
    return yield* AccountError.invalidOptions({
      account,
      detail: `lane must be a whole number from 0 to ${lanes[type] - 1} on ${type}`
    })
  }
  const sessionKey = grant.session.signer
  const signers = yield* Effect.fromResult(
    selectSigners(sessionKey, Array.isArray(options.signer) ? options.signer : [options.signer as Signer])
  )
  const precompile = sessionKey.type === "passkey" ? yield* hasP256Precompile(client) : false
  const sign = signHash(signers, { precompile, account })
  const stub = stubSignature(sessionKey, { precompile })

  const address = core.accountAddress(grant)
  const { contracts } = chain
  const compiled = compile(grant.session, contracts)
  const check = options.check !== false
  const statesTime = counters(compiled, contracts).some((counter) => counter.period > BigInt(0))
  const tagged = compiled.userOpPolicies.some((policy) => Address.isEqual(policy.policy, contracts.sessionHook))
  const deployment = grant.accountType.deployment

  // Enabled once seen enabled; until then each operation enables the session (ENABLE mode). An installed grant has no
  // enable signature, so it always uses the session.
  let enabled = chain.signature === "0x"
  const isEnabledNow = Effect.suspend(() =>
    enabled ? Effect.succeed(true) : isEnabled(client, grant, chain).pipe(Effect.tap((now) =>
      Effect.sync(() => {
        enabled = now
      })
    ))
  )
  const encode = (sessionKeySignature: Hex.Hex) =>
    isEnabledNow.pipe(Effect.map((now) =>
      now
        ? encodeUseSignature(grant.id, sessionKeySignature)
        : encodeEnableSignature(grant, chainId, sessionKeySignature)
    ))

  const checkOperation = Effect.fnUntraced(function*(
    operation: UserOperationToSign
  ): Effect.fn.Return<void, ChainError.ChainError | PolicyViolationError.PolicyViolationError> {
    const callData = operation.callData ?? "0x"
    const calls = decodeCalls(callData, address)
    if (calls === undefined) {
      return yield* refuse([{ _tag: "CallNotAllowed", call: 0, to: address, selector: Hex.slice(callData, 0, 4) }])
    }
    const time = statedTime(callData) ?? (yield* latestTimestamp(client))
    const state = yield* readState(client, { grant, chain, compiled, time })
    enabled = enabled || state.enabled
    yield* refuse(evaluateOperation({
      compiled,
      contracts,
      account: address,
      operation: {
        calls,
        sponsored: operation.paymaster !== undefined,
        gasCost: operation.callGasLimit === undefined ? undefined : gasCost(operation)
      },
      state
    }))
  })

  const accountDomain = Effect.suspend(() =>
    type === "safe7579"
      ? Effect.succeed(Erc7739.domainless(chainId, address))
      : call(client, { to: address, data: Erc7739.encodeEip712Domain }).pipe(
        Effect.map((result) => result === undefined || result === "0x" ? undefined : Erc7739.decodeEip712Domain(result))
      )
  )

  const signTypedData = Effect.fnUntraced(function*(
    typedData: TypedDataDefinition
  ): Effect.fn.Return<
    Hex.Hex,
    AccountError.AccountError | ChainError.ChainError | PolicyViolationError.PolicyViolationError
  > {
    const app = typedData as unknown as Erc7739.AppTypedData
    // Session signatures need the session enabled, so the account deployed.
    const domain = (yield* code(client, address)) === undefined ? undefined : yield* accountDomain
    if (domain === undefined) return yield* PolicyViolationError.make([{ _tag: "SessionNotEnabled" }])
    const nested = Erc7739.nest(app, domain)
    if (check) {
      const state = yield* readState(client, { grant, chain, compiled, time: yield* latestTimestamp(client) })
      const verifier = app.domain?.verifyingContract as Hex.Hex | undefined
      yield* refuse(evaluateSignature({ compiled, contracts, nested, verifier, state }))
    }
    return Erc7739.encodeSignature({
      type,
      smartSession: contracts.smartSession,
      permissionId: grant.id,
      sessionKeySignature: yield* sign(nested.digest),
      nested
    })
  })

  // Every hook runs an Effect at the Promise boundary, so it rejects with Namera's errors.
  const implementation = {
    client: chainClient,
    entryPoint,
    getAddress: () => Promise.resolve(address),
    getFactoryArgs: () =>
      Promise.resolve(
        deployment === undefined
          ? { factory: undefined, factoryData: undefined }
          : { factory: deployment.factory, factoryData: deployment.factoryData }
      ),
    // Always the lane: viem's per-call nonce keys would leave Smart Sessions.
    getNonce: () => run(nonce(chainClient, address, nonceKey(type, contracts.smartSession, lane))),
    encodeCalls: (calls: ReadonlyArray<DecodedCall>) =>
      run(
        (statesTime ? latestTimestamp(client) : Effect.succeed(undefined) as Effect.Effect<
          bigint | undefined,
          ChainError.ChainError
        >).pipe(
          Effect.map((time) => encodeCalls({ type, calls, time, tag: tagged ? grant.id : undefined }))
        )
      ),
    // viem estimates gas with the stub before it signs, and a bundler refuses a violating operation there, so the
    // check runs first here (without gas, which isn't known yet) and again before signing.
    getStubSignature: (operation: UserOperationToSign) =>
      run(Effect.gen(function*() {
        if (check) yield* checkOperation(operation)
        return yield* encode(stub)
      })),
    signMessage: () =>
      Promise.reject(
        AccountError.notSupported({
          account,
          detail: "a session key signs typed data only (ERC-7739 TypedDataSign); use signTypedData"
        })
      ),
    signTypedData: (typedData: TypedDataDefinition) => run(signTypedData(typedData)),
    signUserOperation: (operation: UserOperationToSign) =>
      run(Effect.gen(function*() {
        if (check) yield* checkOperation(operation)
        const hash = userOperationHash({ userOperation: operation, sender: address, chainId })
        return yield* encode(yield* sign(hash))
      }))
  } as unknown as SmartAccountImplementation
  return yield* Effect.tryPromise({
    try: () => build(implementation) as Promise<SmartAccount>,
    catch: (cause) => AccountError.invalidOptions({ account, detail: "viem could not build the account", cause })
  })
})
