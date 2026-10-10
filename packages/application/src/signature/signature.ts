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
  PrepareManagedSignatureResponse,
  CompleteManagedSignatureRequest,
} from "@namera-ai/protocol/dto";

import { makeCompleteSignature } from "./complete.js";
import { makePrepareSignature } from "./prepare.js";
import { makeVerifySignature } from "./verify.js";

export interface SignatureApplication {
  readonly prepareManaged: (
    input: Parameters<SignatureApplication["prepare"]>[0],
  ) => Effect.Effect<PrepareManagedSignatureResponse, BillingError | SignatureError>;
  readonly completeManaged: (input: {
    readonly actor: GrantedActorData;
    readonly request: CompleteManagedSignatureRequest;
  }) => Effect.Effect<CompleteSignatureResponse, SignatureError>;
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
    prepareManaged: (input) =>
      prepare({ ...input, custody: "namera-managed" }).pipe(
        Effect.map(({ signing: _signing, ...result }) => result),
      ),
    completeManaged: (input) => complete({ ...input, custody: "namera-managed" }),
    verify,
  } satisfies SignatureApplication;
});
