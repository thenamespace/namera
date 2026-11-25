import * as Result from "effect/Result"

import * as SessionError from "../../SessionError.ts"
import * as compile from "../core/session/compile.ts"
import * as core from "../core/session/session.ts"
import { contracts } from "./contracts.ts"

/** Builds a session, or fails with every malformed part. @internal */
export const from = (options: core.Options): Result.Result<core.Session, SessionError.SessionError> => {
  const result = core.make(options)
  return "session" in result
    ? Result.succeed(result.session)
    : Result.fail(SessionError.invalidSession(result.problems))
}

/** The session's permission id. @internal */
export const permissionId = (session: core.Session): `0x${string}` => compile.permissionId(session, contracts)

/** Smart Sessions' `Session` struct for the session. @internal */
export const toSmartSession = (session: core.Session): compile.Compiled => compile.compile(session, contracts)

/** Whole seconds `{ days, hours, minutes, seconds }` add up to. @internal */
export const duration = (options: {
  readonly days?: number | undefined
  readonly hours?: number | undefined
  readonly minutes?: number | undefined
  readonly seconds?: number | undefined
}): number =>
  Math.floor(
    (options.days ?? 0) * 86400 + (options.hours ?? 0) * 3600 + (options.minutes ?? 0) * 60 + (options.seconds ?? 0)
  )
