import { Effect } from "effect";

import type { SignatureError, BillingError } from "@namera-ai/protocol";
import type {
  GrantedActorData,
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
  } satisfies SignatureApplication;
});
