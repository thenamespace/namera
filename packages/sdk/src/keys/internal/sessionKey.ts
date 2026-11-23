import * as Result from "effect/Result"

import * as core from "../../internal/core/sessionKey.ts"
import * as SessionKeyError from "../SessionKeyError.ts"

const reason = (problem: core.Problem): SessionKeyError.SessionKeyErrorReason => {
  switch (problem._tag) {
    case "InvalidAddress":
      return new SessionKeyError.InvalidAddress({ value: problem.value })
    case "InvalidPublicKey":
      return new SessionKeyError.InvalidPublicKey({ value: problem.value })
    case "NoSigners":
      return new SessionKeyError.NoSigners({})
    case "DuplicateSigner":
      return new SessionKeyError.DuplicateSigner({ signer: problem.signer })
    case "InvalidThreshold":
      return new SessionKeyError.InvalidThreshold({ threshold: problem.threshold, signers: problem.signers })
  }
}

/** A k-of-n ECDSA session key, validated. @internal */
export const ecdsaThreshold = (options: {
  readonly threshold: number
  readonly signers: ReadonlyArray<string>
}): Result.Result<core.EcdsaSessionKey, SessionKeyError.SessionKeyError> => {
  const result = core.ecdsa(options.threshold, options.signers)
  return "sessionKey" in result
    ? Result.succeed(result.sessionKey)
    : Result.fail(new SessionKeyError.SessionKeyError({ reason: reason(result.problem) }))
}

/** A k-of-n passkey session key, validated. @internal */
export const passkeyThreshold = (options: {
  readonly threshold: number
  readonly passkeys: ReadonlyArray<
    { readonly publicKey: string; readonly requireUserVerification?: boolean | undefined }
  >
}): Result.Result<core.PasskeySessionKey, SessionKeyError.SessionKeyError> => {
  const result = core.passkey(options.threshold, options.passkeys)
  return "sessionKey" in result
    ? Result.succeed(result.sessionKey)
    : Result.fail(new SessionKeyError.SessionKeyError({ reason: reason(result.problem) }))
}
