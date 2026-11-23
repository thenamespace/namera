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
  smartSession: SmartSession.v1.address,
  ecdsaSessionValidator: ECDSASessionValidator.v1.address,
  webAuthnValidator: WebAuthnValidator.v1.address,
  sessionHook: SessionHook.v1.address,
  allowPolicy: AllowPolicy.v1.address,
  argPolicy: ArgPolicy.v1.address,
  spendPolicy: SpendPolicy.v1.address,
  valuePolicy: ValuePolicy.v1.address,
  rateLimitPolicy: RateLimitPolicy.v1.address,
  gasPolicy: GasPolicy.v1.address,
  approvalPolicy: ApprovalPolicy.v1.address,
  signaturePolicy: SignaturePolicy.v1.address
}
