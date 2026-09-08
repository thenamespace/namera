import { Effect, Encoding, Schema } from "effect";

import { EvmExecutionError } from "@namera-ai/protocol";
import { concatHex, hashMessage, hexToBytes } from "viem";

import { encodeVerifiedOwnerAssertion } from "../accounts/passkey-signature.js";
import type { ChainData } from "../chains/data.js";
import type { ExecutionClients } from "../clients/execution.js";
import { makeReconstructPreparedAccount } from "./prepared-account.js";
import { completeSignedEvmExecution, preparedUserOperationHash } from "./signed-operation.js";
import type { CompleteEvmOwnerApprovalInput, SignEvmExecutionInput } from "./types.js";

const ClientData = Schema.fromJsonString(
  Schema.Struct({
    type: Schema.Literal("webauthn.get"),
    challenge: Schema.String,
  }),
);

export const makeEvmOwnerApproval = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
) => {
  const reconstruct = makeReconstructPreparedAccount(getClients);
  const resolve = Effect.fn("evm.execution.resolveOwnerApproval")(function* (
    input: SignEvmExecutionInput,
  ) {
    if (input.account.owner.validatorType !== "webauthn_p256" || input.session !== undefined) {
      return yield* new EvmExecutionError({
        code: "SIGNING_FAILED",
        cause: new Error("Owner approval requires a passkey"),
      });
    }
    const { chain } = yield* reconstruct(input);
    // The deployed WebAuthn adapter personal-signs the ERC-4337 digest.
    const challenge = hashMessage({ raw: preparedUserOperationHash(input.prepared, chain) });
    return { chain, challenge };
  });

  return {
    challenge: Effect.fn("evm.execution.ownerApprovalChallenge")(function* (
      input: SignEvmExecutionInput,
    ) {
      return (yield* resolve(input)).challenge;
    }),
    complete: Effect.fn("evm.execution.completeOwnerApproval")(function* (
      input: CompleteEvmOwnerApprovalInput,
    ) {
      const { chain, challenge } = yield* resolve(input);
      const clientData = yield* Schema.decodeUnknownEffect(ClientData)(
        input.assertion.clientDataJSON,
      ).pipe(Effect.mapError((cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause })));
      if (clientData.challenge !== Encoding.encodeBase64Url(hexToBytes(challenge))) {
        return yield* new EvmExecutionError({
          code: "SIGNING_FAILED",
          cause: new Error("The owner approval does not match the prepared operation"),
        });
      }
      // Credential/origin/RP/UV verification belongs to Passkeys. This boundary
      // accepts only its verified assertion, never a raw browser response.
      const signature = yield* Effect.try({
        try: () => concatHex(["0xff", encodeVerifiedOwnerAssertion(input.assertion)]),
        catch: (cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause }),
      });
      return yield* completeSignedEvmExecution(input.prepared, chain, signature);
    }),
  };
};
