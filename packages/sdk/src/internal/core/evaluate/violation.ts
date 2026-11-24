import type * as Hex from "ox/Hex"

/**
 * Why a session would refuse an operation or a signature, as plain data. `PolicyViolationError` gives each a message
 * and a hint.
 */
export type Violation =
  | {
    readonly _tag: "CallNotAllowed"
    readonly call: number
    readonly to: Hex.Hex
    readonly selector: Hex.Hex
  }
  | {
    readonly _tag: "ArgumentRejected"
    readonly call: number
    readonly to: Hex.Hex
    readonly selector: Hex.Hex
    readonly policy: "arguments" | "approvals"
  }
  | {
    readonly _tag: "SpendLimitExceeded"
    readonly token: Hex.Hex
    readonly attempted: bigint
    readonly remaining: bigint
    readonly resetsAt?: number | undefined
  }
  | {
    readonly _tag: "ValueLimitExceeded"
    readonly attempted: bigint
    readonly remaining: bigint
    readonly resetsAt?: number | undefined
  }
  | { readonly _tag: "RateLimited"; readonly remaining: bigint; readonly resetsAt?: number | undefined }
  | {
    readonly _tag: "GasLimitExceeded"
    readonly attempted: bigint
    readonly remaining: bigint
    readonly resetsAt?: number | undefined
  }
  | { readonly _tag: "SignatureNotAllowed"; readonly detail: string }
  | { readonly _tag: "PaymasterNotAllowed" }
  | { readonly _tag: "SessionExpired"; readonly validUntil: number }
  | { readonly _tag: "SessionNotYetValid"; readonly validAfter: number }
  | { readonly _tag: "SessionNotEnabled" }
  | { readonly _tag: "SessionRevoked" }
