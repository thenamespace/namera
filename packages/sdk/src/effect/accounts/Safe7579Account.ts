/**
 * The Effect form of `Safe7579Account`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as Effect from "effect/Effect"

import type * as AccountError from "../../accounts/AccountError.ts"
import * as internal from "../../accounts/internal/safe7579.ts"
import type * as Safe7579Account_ from "../../accounts/Safe7579Account.ts"
import type * as ChainError from "../../ChainError.ts"

/**
 * A Safe7579 account built by Namera.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Safe7579Account = Safe7579Account_.Safe7579Account

/**
 * Builds a Safe7579 account for its owners, at its counterfactual address unless `address` is given.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from: (
  options: internal.FromOptions
) => Effect.Effect<Safe7579Account, AccountError.AccountError | ChainError.ChainError> = internal.from
