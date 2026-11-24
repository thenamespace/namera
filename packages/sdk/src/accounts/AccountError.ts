/**
 * Failures building or using a smart account: an unsupported account, Smart Sessions missing, an owner that could
 * not sign, invalid options, a chain the account doesn't match, or an owner change the account can't make.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

import { redactUrls } from "../internal/redact.ts"
import { version } from "../internal/version.ts"
import * as NameraError from "../NameraError.ts"

const TypeId = "~@namera-ai/sdk/accounts/AccountError" as const

const cause = Schema.optional(Schema.Defect())
const detail = Schema.optionalKey(Schema.String)
const Address = Schema.TemplateLiteral(["0x", Schema.String])

const withDetail = (summary: string, detail: string | undefined) =>
  detail === undefined ? summary : `${summary}: ${detail}`

/**
 * The account is not a supported implementation or version. `implementation` is the implementation found on chain,
 * when there is one.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class NotSupported extends Schema.TaggedError<NotSupported>("@namera-ai/sdk/accounts/AccountError/NotSupported")(
  "NotSupported",
  { implementation: Schema.optionalKey(Address), detail, cause }
) {
  override get message(): string {
    return withDetail("The account is not a supported smart account", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Namera supports Kernel 3.3 on EntryPoint 0.7, deployed or through EIP-7702."
  }
}

/**
 * The account does not have Smart Sessions installed as a validator.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SessionsNotInstalled
  extends Schema.TaggedError<SessionsNotInstalled>("@namera-ai/sdk/accounts/AccountError/SessionsNotInstalled")(
    "SessionsNotInstalled",
    { detail, cause }
  )
{
  override get message(): string {
    return withDetail("Smart Sessions is not installed on the account", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Install it with `SmartAccount.installSessions`, or batch `SmartAccount.installSessionsCalls` into an operation."
  }
}

/**
 * The owner rejected or failed to produce a signature.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SigningFailed
  extends Schema.TaggedError<SigningFailed>("@namera-ai/sdk/accounts/AccountError/SigningFailed")(
    "SigningFailed",
    { detail, cause }
  )
{
  override get message(): string {
    return withDetail("The owner could not sign", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "The owner's key or wallet failed to sign; its error is the reason's `cause`."
  }
}

/**
 * The options cannot describe a valid account, such as a threshold above the number of owners or a client without
 * a chain.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class InvalidOptions
  extends Schema.TaggedError<InvalidOptions>("@namera-ai/sdk/accounts/AccountError/InvalidOptions")(
    "InvalidOptions",
    { detail, cause }
  )
{
  override get message(): string {
    return withDetail("The account options are invalid", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Fix the option the message names."
  }
}

/**
 * The account was used on a chain other than the one it was built for.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class ChainMismatch
  extends Schema.TaggedError<ChainMismatch>("@namera-ai/sdk/accounts/AccountError/ChainMismatch")(
    "ChainMismatch",
    { expected: Schema.Int, actual: Schema.Int, detail, cause }
  )
{
  override get message(): string {
    return withDetail(`The account is on chain ${this.expected}, not ${this.actual}`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return `Use a client for chain ${this.expected}.`
  }
}

/**
 * The owner to remove or replace is not an owner of the account.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class OwnerNotFound
  extends Schema.TaggedError<OwnerNotFound>("@namera-ai/sdk/accounts/AccountError/OwnerNotFound")(
    "OwnerNotFound",
    { owner: Address, detail, cause }
  )
{
  override get message(): string {
    return withDetail(`${this.owner} is not an owner of the account`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "List the account's owners with `SmartAccount.getOwners`."
  }
}

/**
 * The owner to add already owns the account.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class OwnerExists extends Schema.TaggedError<OwnerExists>("@namera-ai/sdk/accounts/AccountError/OwnerExists")(
  "OwnerExists",
  { owner: Address, detail, cause }
) {
  override get message(): string {
    return withDetail(`${this.owner} already owns the account`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Nothing to add; list the account's owners with `SmartAccount.getOwners`."
  }
}

/**
 * The change would leave fewer owners than must sign, such as removing the last owner or a threshold above the
 * number of owners.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class ThresholdUnreachable
  extends Schema.TaggedError<ThresholdUnreachable>("@namera-ai/sdk/accounts/AccountError/ThresholdUnreachable")(
    "ThresholdUnreachable",
    { threshold: Schema.Int, owners: Schema.Int, detail, cause }
  )
{
  override get message(): string {
    return withDetail(
      `A threshold of ${this.threshold} with ${this.owners} owner${this.owners === 1 ? "" : "s"} can never sign`,
      this.detail
    )
  }

  /** What to do about it. */
  get hint(): string {
    return "Lower the threshold with `SmartAccount.setThreshold` first, or add an owner before removing one."
  }
}

/**
 * The account can't make this change, such as adding a second key to Kernel's single-key validator, or changing the
 * owners of an account that isn't deployed yet.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class OperationNotSupported
  extends Schema.TaggedError<OperationNotSupported>("@namera-ai/sdk/accounts/AccountError/OperationNotSupported")(
    "OperationNotSupported",
    { operation: Schema.String, detail, cause }
  )
{
  override get message(): string {
    return withDetail(`The account can't ${this.operation}`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Kernel's key validator holds one key, which only `SmartAccount.replaceOwner` rotates; owners of another kind need `SmartAccount.addOwnerValidator`."
  }
}

/**
 * Schema for the reason of an `AccountError`.
 *
 * @stability experimental
 * @category schemas
 * @since 2.0.0
 */
export const AccountErrorReason: Schema.Union<
  [
    typeof NotSupported,
    typeof SessionsNotInstalled,
    typeof SigningFailed,
    typeof InvalidOptions,
    typeof ChainMismatch,
    typeof OwnerNotFound,
    typeof OwnerExists,
    typeof ThresholdUnreachable,
    typeof OperationNotSupported
  ]
> = Schema.Union([
  NotSupported,
  SessionsNotInstalled,
  SigningFailed,
  InvalidOptions,
  ChainMismatch,
  OwnerNotFound,
  OwnerExists,
  ThresholdUnreachable,
  OperationNotSupported
])

/**
 * The specific failure behind an `AccountError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type AccountErrorReason = typeof AccountErrorReason.Type

/**
 * Schema for the account an `AccountError` is about: its type (`kernel`, or `unknown` before detection) and address.
 *
 * @stability experimental
 * @category schemas
 * @since 2.0.0
 */
export const AccountRef: Schema.Struct<{
  readonly type: Schema.Literals<readonly ["kernel", "unknown"]>
  readonly address: Schema.optionalKey<typeof Address>
}> = Schema.Struct({
  type: Schema.Literals(["kernel", "unknown"]),
  address: Schema.optionalKey(Address)
})

/**
 * A failure building or using a smart account. `account` says which account, `reason` what failed.
 *
 * **Example** (Narrowing on the reason)
 *
 * ```ts import.meta.vitest
 * import { AccountError } from "@namera-ai/sdk"
 *
 * const error = AccountError.invalidOptions({ account: { type: "kernel" }, detail: "the client has no chain" })
 *
 * error.reason._tag // => "InvalidOptions"
 * error.shortMessage // => "The account options are invalid: the client has no chain"
 * error.metaMessages // => ["Account: kernel", "Hint: Fix the option the message names."]
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class AccountError extends Schema.TaggedError<AccountError>("@namera-ai/sdk/accounts/AccountError")(
  "AccountError",
  { account: AccountRef, reason: AccountErrorReason }
) implements NameraError.Fields {
  readonly [TypeId] = TypeId
  readonly [NameraError.TypeId] = NameraError.TypeId

  override readonly cause = this.reason

  get shortMessage(): string {
    return this.reason.message
  }

  get details(): string | undefined {
    const { cause } = this.reason
    return Predicate.isError(cause) ? redactUrls(cause.message) : undefined
  }

  get docsPath(): string | undefined {
    return undefined
  }

  get metaMessages(): ReadonlyArray<string> {
    const { address, type } = this.account
    return [
      address === undefined ? `Account: ${type}` : `Account: ${type} at ${address}`,
      ...(this.reason._tag === "NotSupported" && this.reason.implementation !== undefined
        ? [`Implementation: ${this.reason.implementation}`]
        : []),
      `Hint: ${this.reason.hint}`
    ]
  }

  get version(): string {
    return `@namera-ai/sdk@${version}`
  }

  override get message(): string {
    return this.shortMessage
  }
}

/**
 * Checks whether a value is an `AccountError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isAccountError = (u: unknown): u is AccountError => Predicate.hasProperty(u, TypeId)

/**
 * The options every `AccountError` constructor accepts: the account, a detail for the message, and the underlying
 * failure.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Options {
  readonly account: typeof AccountRef.Type
  readonly detail?: string | undefined
  readonly cause?: unknown
}

const reasonFields = ({ cause, detail }: Options) => ({
  ...(detail === undefined ? {} : { detail }),
  ...(cause === undefined ? {} : { cause })
})

/**
 * Creates an `AccountError` for an unsupported account. `implementation` is the implementation found on chain.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const notSupported = (
  options: Options & { readonly implementation?: `0x${string}` | undefined }
): AccountError =>
  new AccountError({
    account: options.account,
    reason: new NotSupported({
      ...reasonFields(options),
      ...(options.implementation === undefined ? {} : { implementation: options.implementation })
    })
  })

/**
 * Creates an `AccountError` for an account without Smart Sessions.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const sessionsNotInstalled = (options: Options): AccountError =>
  new AccountError({ account: options.account, reason: new SessionsNotInstalled(reasonFields(options)) })

/**
 * Creates an `AccountError` for an owner that could not sign.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const signingFailed = (options: Options): AccountError =>
  new AccountError({ account: options.account, reason: new SigningFailed(reasonFields(options)) })

/**
 * Creates an `AccountError` for options that cannot describe a valid account.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const invalidOptions = (options: Options): AccountError =>
  new AccountError({ account: options.account, reason: new InvalidOptions(reasonFields(options)) })

/**
 * Creates an `AccountError` for an account used on the wrong chain.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const chainMismatch = (
  options: Options & { readonly expected: number; readonly actual: number }
): AccountError =>
  new AccountError({
    account: options.account,
    reason: new ChainMismatch({ ...reasonFields(options), expected: options.expected, actual: options.actual })
  })

/**
 * Creates an `AccountError` for an owner the account doesn't have.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const ownerNotFound = (options: Options & { readonly owner: `0x${string}` }): AccountError =>
  new AccountError({
    account: options.account,
    reason: new OwnerNotFound({ ...reasonFields(options), owner: options.owner })
  })

/**
 * Creates an `AccountError` for an owner the account already has.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const ownerExists = (options: Options & { readonly owner: `0x${string}` }): AccountError =>
  new AccountError({
    account: options.account,
    reason: new OwnerExists({ ...reasonFields(options), owner: options.owner })
  })

/**
 * Creates an `AccountError` for a change that would leave fewer owners than the threshold.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const thresholdUnreachable = (
  options: Options & { readonly threshold: number; readonly owners: number }
): AccountError =>
  new AccountError({
    account: options.account,
    reason: new ThresholdUnreachable({
      ...reasonFields(options),
      threshold: options.threshold,
      owners: options.owners
    })
  })

/**
 * Creates an `AccountError` for an owner change the account can't make.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const operationNotSupported = (options: Options & { readonly operation: string }): AccountError =>
  new AccountError({
    account: options.account,
    reason: new OperationNotSupported({ ...reasonFields(options), operation: options.operation })
  })
