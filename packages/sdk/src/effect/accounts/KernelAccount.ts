/**
 * The Effect form of `KernelAccount`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as Effect from "effect/Effect"

import type * as AccountError from "../../accounts/AccountError.ts"
import * as internal from "../../accounts/internal/kernel.ts"
import type * as KernelAccount_ from "../../accounts/KernelAccount.ts"
import type * as ChainError from "../../ChainError.ts"

/**
 * A Kernel account built by Namera.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type KernelAccount = KernelAccount_.KernelAccount

/**
 * Builds a Kernel account for an owner, at its counterfactual address unless `address` is given.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from: (
  options: internal.FromOptions
) => Effect.Effect<KernelAccount, AccountError.AccountError | ChainError.ChainError> = internal.from

/**
 * Builds a Kernel account on the owner's own address through EIP-7702.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const fromEip7702: (
  options: internal.FromEip7702Options
) => Effect.Effect<KernelAccount, AccountError.AccountError | ChainError.ChainError> = internal.fromEip7702
