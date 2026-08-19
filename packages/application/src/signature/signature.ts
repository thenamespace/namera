import { Effect } from "effect";

import type { BillingError, SignatureError } from "@namera-ai/protocol";
import type {
  GrantedActorData,
  SignRequest,
  SignResponse,
  VerifySignatureRequest,
  VerifySignatureResponse,
} from "@namera-ai/protocol/dto";

import { makeSign } from "./sign.js";
import { makeVerifySignature } from "./verify.js";

export interface SignatureApplication {
  readonly sign: (input: {
    readonly actor: GrantedActorData;
    readonly idempotencyKey: string;
    readonly request: SignRequest;
  }) => Effect.Effect<SignResponse, BillingError | SignatureError>;
  readonly verify: (input: {
    readonly actor: GrantedActorData;
    readonly request: VerifySignatureRequest;
  }) => Effect.Effect<VerifySignatureResponse, SignatureError>;
}

export const makeSignatureApplication = Effect.gen(function* () {
  const sign = yield* makeSign;
  const verify = yield* makeVerifySignature;
  return { sign, verify } satisfies SignatureApplication;
});
