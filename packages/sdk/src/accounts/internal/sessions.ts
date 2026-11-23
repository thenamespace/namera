import * as Effect from "effect/Effect"

import * as ChainError from "../../ChainError.ts"
import {
  type Call,
  decodeIsModuleInstalled,
  encodeIsModuleInstalled,
  MODULE_TYPE_HOOK,
  MODULE_TYPE_VALIDATOR
} from "../../internal/core/account/erc7579.ts"
import * as SessionHook from "../../internal/core/account/sessionHook.ts"
import { call, code, type Hex, type ReadClient } from "../../internal/viem/client.ts"
import {
  type BundlerClient,
  sendUserOperation,
  type TransactionReceipt,
  waitForUserOperationReceipt
} from "../../internal/viem/smartAccount.ts"
import * as AccountError from "../AccountError.ts"
import * as Kernel from "./kernel.ts"
import * as Nexus from "./nexus.ts"
import * as Safe7579 from "./safe7579.ts"
import { sessionModules } from "./sessionModules.ts"
import type { NameraSmartAccount } from "./smartAccount.ts"

// A view that reverts (no such function, no code) reads as `undefined`.
const read = (client: ReadClient, to: Hex, data: Hex) =>
  call(client, { to, data }).pipe(
    Effect.map((result) => (result === undefined || result === "0x" ? undefined : result)),
    Effect.orElseSucceed(() => undefined)
  )

/**
 * Checks whether Smart Sessions is installed on the account as a validator, with SessionHook running for its
 * operations: as the account's hook (Nexus, Safe7579), or bound to Smart Sessions' validation (Kernel).
 *
 * @internal
 */
export const isSessionsInstalled = Effect.fnUntraced(function*(
  client: ReadClient,
  address: Hex
): Effect.fn.Return<boolean, ChainError.ChainError> {
  if ((yield* code(client, address)) === undefined) return false
  const validator = yield* read(
    client,
    address,
    encodeIsModuleInstalled(MODULE_TYPE_VALIDATOR, sessionModules.smartSession)
  )
  if (validator === undefined || !decodeIsModuleInstalled(validator)) return false

  const hook = yield* read(client, address, encodeIsModuleInstalled(MODULE_TYPE_HOOK, sessionModules.sessionHook))
  if (hook !== undefined && decodeIsModuleInstalled(hook)) return true
  const bound = yield* read(client, address, SessionHook.encodeValidationConfig(sessionModules.smartSession))
  return bound !== undefined && BigInt(SessionHook.decodeValidationHook(bound)) === BigInt(sessionModules.sessionHook)
})

/** The calls that install Smart Sessions on a Namera account, for batching with other calls. @internal */
export const installSessionsCalls = (account: NameraSmartAccount): ReadonlyArray<Call> => {
  switch (account.namera.type) {
    case "kernel":
      return Kernel.installSessionsCalls(account.address)
    case "nexus":
      return Nexus.installSessionsCalls(account.address)
    case "safe7579":
      return Safe7579.installSessionsCalls(account.address)
  }
}

const bundlerAccount = (client: BundlerClient): Effect.Effect<NameraSmartAccount, AccountError.AccountError> =>
  client.account === undefined || !("namera" in client.account)
    ? Effect.fail(
      AccountError.notSupported({ account: { type: "unknown" }, detail: "the bundler client has no Namera account" })
    )
    : Effect.succeed(client.account as NameraSmartAccount)

/** Sends one user operation that installs Smart Sessions, returning its hash. @internal */
export const installSessions = Effect.fnUntraced(function*(
  client: BundlerClient
): Effect.fn.Return<Hex, AccountError.AccountError | ChainError.ChainError> {
  const account = yield* bundlerAccount(client)
  // Nexus and Safe7579 hold one global hook: installing SessionHook next to another one reverts on chain.
  if (account.namera.type !== "kernel") {
    const active = yield* read(account.client as ReadClient, account.address, SessionHook.encodeGetActiveHook)
    const hook = active === undefined ? undefined : SessionHook.decodeActiveHook(active)
    if (hook !== undefined && BigInt(hook) !== BigInt(0) && BigInt(hook) !== BigInt(sessionModules.sessionHook)) {
      return yield* AccountError.operationNotSupported({
        account: { type: account.namera.type, address: account.address },
        operation: "install sessions",
        detail: `it already has the hook ${hook}, and SessionHook must be its only hook`
      })
    }
  }
  return yield* sendUserOperation(client, { account, calls: installSessionsCalls(account) })
})

/** Installs Smart Sessions and waits until the operation is included, returning its transaction receipt. @internal */
export const installSessionsSync = Effect.fnUntraced(function*(
  client: BundlerClient
): Effect.fn.Return<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> {
  const hash = yield* installSessions(client)
  const { receipt, success } = yield* waitForUserOperationReceipt(client, hash)
  if (!success) {
    return yield* ChainError.reverted({
      method: "eth_sendUserOperation",
      chainId: client.chain?.id,
      detail: `user operation ${hash} reverted`
    })
  }
  return receipt
})
