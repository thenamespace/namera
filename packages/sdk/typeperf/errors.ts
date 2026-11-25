// The error API: `instanceof` and reason narrowing, the `NameraError` union, `catchTag` and `catchReason`, reason
// types and constructors.
import { ChainError, GrantError, NameraError, PolicyViolationError } from "@namera-ai/sdk"
import { Grant } from "@namera-ai/sdk/effect"
import * as Effect from "effect/Effect"

export const rpcCode = (error: unknown) =>
  error instanceof ChainError.ChainError && error.reason._tag === "Rpc" ? error.reason.code : undefined

export const summary = (error: unknown) =>
  NameraError.isNameraError(error) ? [error._tag, error.shortMessage, error.metaMessages] as const : undefined

export const parsed = Grant.parse("token").pipe(
  Effect.catchReason("GrantError", "Malformed", (reason) => Effect.succeed(reason.detail)),
  Effect.catchTag("GrantError", (error) => Effect.succeed(error.reason._tag))
)

export const tag: ChainError.ChainErrorReason["_tag"] = "Rpc"
export const revoked = new PolicyViolationError.SessionRevoked()
export const malformed = new GrantError.Malformed({ detail: "not a grant" })

export const reasonTag = (error: NameraError.NameraError) => {
  switch (error._tag) {
    case "ChainError":
      return error.reason._tag
    case "PolicyViolationError":
      return error.violations[0]._tag
    default:
      return error._tag
  }
}
