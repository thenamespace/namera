import * as AllowPolicy from "@namera-ai/contracts/AllowPolicy"
import * as ApprovalPolicy from "@namera-ai/contracts/ApprovalPolicy"
import * as ArgPolicy from "@namera-ai/contracts/ArgPolicy"
import * as ECDSASessionValidator from "@namera-ai/contracts/ECDSASessionValidator"
import * as GasPolicy from "@namera-ai/contracts/GasPolicy"
import * as RateLimitPolicy from "@namera-ai/contracts/RateLimitPolicy"
import * as SessionHook from "@namera-ai/contracts/SessionHook"
import * as SignaturePolicy from "@namera-ai/contracts/SignaturePolicy"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as SpendPolicy from "@namera-ai/contracts/SpendPolicy"
import * as ValuePolicy from "@namera-ai/contracts/ValuePolicy"
import * as WebAuthnValidator from "@namera-ai/contracts/WebAuthnValidator"

import type { Contracts } from "../core/session/compile.ts"

/**
 * The contracts sessions compile to: Namera's v1 deployments, at the same address on every chain.
 *
 * @internal
 */
export const contracts: Contracts = {
  smartSession: SmartSession.addressV1,
  ecdsaSessionValidator: ECDSASessionValidator.addressV1,
  webAuthnValidator: WebAuthnValidator.addressV1,
  sessionHook: SessionHook.addressV1,
  allowPolicy: AllowPolicy.addressV1,
  argPolicy: ArgPolicy.addressV1,
  spendPolicy: SpendPolicy.addressV1,
  valuePolicy: ValuePolicy.addressV1,
  rateLimitPolicy: RateLimitPolicy.addressV1,
  gasPolicy: GasPolicy.addressV1,
  approvalPolicy: ApprovalPolicy.addressV1,
  signaturePolicy: SignaturePolicy.addressV1
}
