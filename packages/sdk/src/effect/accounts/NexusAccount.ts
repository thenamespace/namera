/**
 * The Effect form of `NexusAccount`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as Effect from "effect/Effect"

import type * as AccountError from "../../accounts/AccountError.ts"
import * as internal from "../../accounts/internal/nexus.ts"
import type * as NexusAccount_ from "../../accounts/NexusAccount.ts"
import type * as ChainError from "../../ChainError.ts"

/**
 * A Nexus account built by Namera.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type NexusAccount = NexusAccount_.NexusAccount

/**
 * Builds a Nexus account for an owner, at its counterfactual address unless `address` is given.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from: (
  options: internal.FromOptions
) => Effect.Effect<NexusAccount, AccountError.AccountError | ChainError.ChainError> = internal.from

/**
 * Builds a Nexus account on the owner's own address through EIP-7702.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const fromEip7702: (
  options: internal.FromEip7702Options
) => Effect.Effect<NexusAccount, AccountError.AccountError | ChainError.ChainError> = internal.fromEip7702
