import * as Effect from "effect/Effect"
import { SignatureErc6492 } from "ox/erc6492"
import type * as Hex from "ox/Hex"

import * as AccountError from "../../../accounts/AccountError.ts"
import type * as ChainError from "../../../ChainError.ts"
import {
  circleChains,
  circleGas,
  circlePaymasterData,
  permitAmount,
  permitReads,
  permitTypedData
} from "../../../internal/core/circle.ts"
import { isNameraError } from "../../../internal/nameraError.ts"
import { run } from "../../../internal/promise.ts"
import { call } from "../../../internal/viem/client.ts"
import type { SmartAccount } from "../../../internal/viem/smartAccount.ts"
import type { NameraError } from "../../../NameraError.ts"
import * as CompatError from "../../CompatError.ts"
import * as PaymasterError from "../../PaymasterError.ts"
import { boundAccount, type Paymaster } from "../paymaster.ts"

/**
 * What `Paymaster.circle` takes: the token (USDC), the most it permits per operation, and the account to sign with
 * when the bundler client isn't configured by a Namera bundler helper.
 *
 * @internal
 */
export interface Options {
  readonly token: "USDC"
  readonly maxAmount?: bigint | undefined
  readonly account?: SmartAccount | undefined
}

/**
 * The default `maxAmount`: 1 USDC, far above an operation's gas on the chains Circle's v0.7 paymaster is on.
 *
 * @internal
 */
export const DEFAULT_MAX_AMOUNT = BigInt(1_000_000)

interface Operation {
  readonly chainId: number
  readonly sender: Hex.Hex
  readonly callGasLimit?: bigint | undefined
  readonly verificationGasLimit?: bigint | undefined
  readonly preVerificationGas?: bigint | undefined
  readonly maxFeePerGas?: bigint | undefined
}

const zero = BigInt(0)

const maxCost = (operation: Operation): bigint =>
  ((operation.callGasLimit ?? zero) + (operation.verificationGasLimit ?? zero) + (operation.preVerificationGas ?? zero)
    + circleGas.verification + circleGas.postOp) * (operation.maxFeePerGas ?? zero)

/**
 * Circle's USDC paymaster for EntryPoint 0.7. It has no API: the account signs an EIP-2612 permit of USDC to the
 * paymaster, attached as `paymasterData`. The stub permits `maxAmount` so the bundler can simulate the paymaster;
 * the final data permits the estimated worst-case cost plus a margin, at most `maxAmount`.
 *
 * @internal
 */
export const circle = (options: Options): Paymaster => {
  const maxAmount = options.maxAmount ?? DEFAULT_MAX_AMOUNT

  const paymasterData = (self: object, operation: Operation, amount: () => bigint) =>
    Effect.gen(function*() {
      const chain = circleChains[operation.chainId]
      if (chain === undefined) {
        return yield* CompatError.incompatible([{
          code: "NOT_ON_CHAIN",
          message: `Circle's EntryPoint 0.7 paymaster is not on chain ${operation.chainId}`
        }])
      }
      const account = options.account ?? boundAccount(self, operation.chainId, operation.sender)
      if (account === undefined) {
        return yield* PaymasterError.rejected({
          vendor: "circle",
          message:
            "Paymaster.circle needs the account to sign its permit: configure the bundler client with a Namera bundler helper (Bundler.*), or pass `account`"
        })
      }

      const reads = permitReads(operation.sender)
      const read = <A>(entry: { readonly data: Hex.Hex; readonly decode: (result: Hex.Hex) => A }) =>
        call(account.client, { to: chain.usdc, data: entry.data }).pipe(
          Effect.map((result) => entry.decode(result ?? "0x"))
        )
      const [name, version, nonce] = yield* Effect.all([read(reads.name), read(reads.version), read(reads.nonce)], {
        concurrency: 3
      })

      const value = amount()
      const typedData = permitTypedData({
        token: { address: chain.usdc, name, version },
        chainId: operation.chainId,
        owner: operation.sender,
        spender: chain.paymaster,
        value,
        nonce
      })
      const signed = yield* Effect.tryPromise({
        try: () => account.signTypedData(typedData as never),
        catch: (cause): NameraError =>
          isNameraError(cause) ? cause : AccountError.signingFailed({ account: { type: "unknown" }, cause })
      })
      // A counterfactual account wraps its signature for ERC-6492; the paymaster checks it after the account is
      // deployed in the same operation, through ERC-1271.
      const signature = SignatureErc6492.validate(signed) ? SignatureErc6492.unwrap(signed).signature : signed

      return {
        paymaster: chain.paymaster,
        paymasterData: circlePaymasterData({ token: chain.usdc, amount: value, signature }),
        paymasterVerificationGasLimit: circleGas.verification,
        paymasterPostOpGasLimit: circleGas.postOp
      }
    }) as Effect.Effect<
      {
        readonly paymaster: Hex.Hex
        readonly paymasterData: Hex.Hex
        readonly paymasterVerificationGasLimit: bigint
        readonly paymasterPostOpGasLimit: bigint
      },
      NameraError | ChainError.ChainError
    >

  const paymaster: Paymaster = {
    vendor: "circle",
    getPaymasterStubData: (parameters) =>
      run(
        Effect.map(
          paymasterData(paymaster, parameters as Operation, () => maxAmount),
          (data) => ({ ...data, isFinal: false })
        )
      ),
    getPaymasterData: (parameters) =>
      run(
        paymasterData(
          paymaster,
          parameters as Operation,
          () => permitAmount(maxCost(parameters as Operation), maxAmount)
        )
      )
  }
  return paymaster
}
