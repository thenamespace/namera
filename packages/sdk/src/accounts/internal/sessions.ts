import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Effect from "effect/Effect"

import * as ChainError from "../../ChainError.ts"
import {
  type Call,
  decodeIsModuleInstalled,
  encodeIsModuleInstalled,
  MODULE_TYPE_VALIDATOR
} from "../../internal/core/account/erc7579.ts"
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
import type { NameraSmartAccount } from "./smartAccount.ts"

/** Checks whether Smart Sessions is installed on the account as a validator. @internal */
export const isSessionsInstalled = Effect.fnUntraced(function*(
  client: ReadClient,
  address: Hex
): Effect.fn.Return<boolean, ChainError.ChainError> {
  if ((yield* code(client, address)) === undefined) return false
  // An account that doesn't implement the view reverts, so it has no Smart Sessions either.
  const result = yield* call(client, {
    to: address,
    data: encodeIsModuleInstalled(MODULE_TYPE_VALIDATOR, SmartSession.v1.address)
  }).pipe(Effect.orElseSucceed(() => undefined))
  return result !== undefined && result !== "0x" && decodeIsModuleInstalled(result)
})

/** The calls that install Smart Sessions on a Namera account, for batching with other calls. @internal */
export const installSessionsCalls = (account: NameraSmartAccount): ReadonlyArray<Call> => {
  switch (account.namera.type) {
    case "kernel":
      return [Kernel.installSessionsCall(account.address)]
    case "nexus":
      return [Nexus.installSessionsCall(account.address)]
    case "safe7579":
      return [Safe7579.installSessionsCall(account.address)]
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
