import * as SessionHook from "@namera-ai/contracts/SessionHook"
import * as SmartSession from "@namera-ai/contracts/SmartSession"

import type { Sessions } from "../../internal/core/account/sessionHook.ts"

/**
 * The modules Namera's sessions run on: Smart Sessions validates them, SessionHook runs their execution policies.
 *
 * @internal
 */
export const sessionModules: Sessions = {
  smartSession: SmartSession.v1.address,
  sessionHook: SessionHook.v1.address
}
