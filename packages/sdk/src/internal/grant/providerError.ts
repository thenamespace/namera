import type { NameraError } from "../../NameraError.ts"
import { toJson } from "../errorJson.ts"

// The errors the agent's EIP-1193 provider rejects with: EIP-1193's `ProviderRpcError` shape (`code`, `message`,
// `data`), with EIP-1193's, JSON-RPC's and EIP-5792's codes. A Namera error keeps its JSON (`NameraError.toJSON`) as
// `data`, so the other side rebuilds it with `NameraError.fromJSON`.

/**
 * The codes the provider uses.
 *
 * @internal
 */
export const codes = {
  invalidParams: -32602,
  internal: -32603,
  unauthorized: 4100,
  unsupportedMethod: 4200,
  unrecognizedChain: 4902,
  unsupportedCapability: 5700,
  unsupportedChain: 5710,
  duplicateId: 5720,
  unknownBundle: 5730
} as const

/**
 * An EIP-1193 provider error.
 *
 * @internal
 */
export class ProviderRpcError extends Error {
  readonly code: number
  readonly data: unknown
  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = "ProviderRpcError"
    this.code = code
    this.data = data
  }
}

/**
 * A provider error with the code, message and optional data.
 *
 * @internal
 */
export const make = (code: number, message: string, data?: unknown): ProviderRpcError =>
  new ProviderRpcError(code, message, data)

// What a refusal is to an app: a policy or the grant not allowing the request is the account's owner not having
// authorized it (4100); a request the account can't sign at all is an unsupported method (4200); anything else (the
// node, the bundler, the paymaster, a combination that can't work) is an internal error.
const codeOf = (error: NameraError): number => {
  switch (error._tag) {
    case "PolicyViolationError":
    case "GrantError":
      return codes.unauthorized
    case "AccountError":
      return error.reason._tag === "NotSupported" ? codes.unsupportedMethod : codes.internal
    default:
      return codes.internal
  }
}

/**
 * The provider error for a Namera error: its code, its `shortMessage`, and its JSON as `data`.
 *
 * @internal
 */
export const fromNameraError = (error: NameraError): ProviderRpcError =>
  make(codeOf(error), error.shortMessage, toJson(error))
