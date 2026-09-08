import { Effect } from "effect";

import { SignatureError, type BillingError } from "@namera-ai/protocol";
import type {
  GrantedActorData,
  SignRequest,
  SignResponse,
  VerifySignatureRequest,
  VerifySignatureResponse,
  PrepareSignatureRequest,
  PrepareSignatureResponse,
  CompleteSignatureRequest,
  CompleteSignatureResponse,
} from "@namera-ai/protocol/dto";

import { makeCompleteSignature } from "./complete.js";
import { makePrepareSignature } from "./prepare.js";
import { makeVerifySignature } from "./verify.js";

export interface SignatureApplication {
  readonly prepare: (input: {
    readonly actor: GrantedActorData;
    readonly idempotencyKey: string;
    readonly request: PrepareSignatureRequest;
  }) => Effect.Effect<PrepareSignatureResponse, BillingError | SignatureError>;
  readonly complete: (input: {
    readonly actor: GrantedActorData;
    readonly request: CompleteSignatureRequest;
  }) => Effect.Effect<CompleteSignatureResponse, SignatureError>;
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
  const prepare = yield* makePrepareSignature;
  const complete = yield* makeCompleteSignature;
  const verify = yield* makeVerifySignature;
  return {
    prepare,
    complete,
    verify,
    // Kept only until client migration removes the old transport. Never fall back
    // to a root signer for routine signature requests.
    sign: Effect.fn("application.signature.signDisabled")(function* () {
      return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
    }),
  } satisfies SignatureApplication;
});
