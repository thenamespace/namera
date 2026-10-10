import { Schema, Struct } from "effect";

import {
  ExecutionSubmissionId,
  SessionKeyId,
  SessionKeyInstallationId,
  SigningKeyId,
} from "#/common/index";
import { Bytes32, EvmPreparedExecution, Hex, UserOperationHash } from "#/evm/index";

import { ExecuteEvmRequest } from "./execution.js";

export const PrepareEvmExecutionRequest = ExecuteEvmRequest.annotate({
  identifier: "PrepareEvmExecutionRequest",
  description:
    "Prepare one call batch for one explicitly selected local session key. Does not sign or broadcast. The SDK reuses its internal idempotency key when retrying preparation.",
});

export const PrepareExecutionRequest = Schema.Union([PrepareEvmExecutionRequest], {
  mode: "oneOf",
}).annotate({ identifier: "PrepareExecutionRequest" });

export const PrepareEvmExecutionResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  submissionId: ExecutionSubmissionId,
  sessionKeyId: SessionKeyId,
  installationId: SessionKeyInstallationId,
  signingKeyId: SigningKeyId,
  prepared: EvmPreparedExecution,
  signing: Schema.Struct({
    method: Schema.Literal("personal_sign"),
    message: Bytes32.annotate({
      description:
        "Canonical ERC-4337 UserOperation hash. Sign these 32 raw bytes with EIP-191 personal-sign, not the UTF-8 hex string and not an unprefixed digest. The client must recompute this hash from prepared before signing.",
    }),
  }),
  expiresAt: Schema.DateTimeUtcFromDate,
}).annotate({
  identifier: "PrepareEvmExecutionResponse",
  description:
    "The persisted unsigned operation and local signer identity. The stub signature in prepared is not authorization. No private key or provider credential is returned.",
});

export const PrepareExecutionResponse = Schema.Union([PrepareEvmExecutionResponse], {
  mode: "oneOf",
}).annotate({ identifier: "PrepareExecutionResponse" });

export const CompleteEvmExecutionRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  submissionId: ExecutionSubmissionId,
  signature: Hex.check(
    Schema.isPattern(/^0x[0-9a-fA-F]{130}$/, {
      message: "Expected a 65-byte secp256k1 personal-sign signature",
    }),
  ).annotate({
    description:
      "The local session signer's 65-byte r/s/v signature. Do not include the Modular Account validation envelope; the server verifies the signer and constructs that envelope from stored authority.",
  }),
}).annotate({
  identifier: "CompleteEvmExecutionRequest",
  description:
    "Authorize the exact stored preparation. Calls, nonce, gas, chain, session and sponsorship cannot be replaced here. Retrying the same submission must not create a second operation.",
});

export const CompleteExecutionRequest = Schema.Union([CompleteEvmExecutionRequest], {
  mode: "oneOf",
}).annotate({ identifier: "CompleteExecutionRequest" });

export type PrepareEvmExecutionRequest = typeof PrepareEvmExecutionRequest.Type;
export type PrepareExecutionRequest = typeof PrepareExecutionRequest.Type;
export type PrepareEvmExecutionResponse = typeof PrepareEvmExecutionResponse.Type;
export type PrepareExecutionResponse = typeof PrepareExecutionResponse.Type;
export type CompleteEvmExecutionRequest = typeof CompleteEvmExecutionRequest.Type;
export type CompleteExecutionRequest = typeof CompleteExecutionRequest.Type;

export const CompleteExecutionResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  submissionId: ExecutionSubmissionId,
  status: Schema.Literals(["prepared", "submitted", "confirmed", "failed"]),
  userOperationHash: UserOperationHash,
}).annotate({
  identifier: "CompleteExecutionResponse",
  description:
    "Durable session-signature acceptance. Prepared means queued for broadcast, not submitted or confirmed. Poll submission status for the chain outcome.",
});
export type CompleteExecutionResponse = typeof CompleteExecutionResponse.Type;

export const PrepareManagedExecutionRequest = PrepareExecutionRequest.annotate({
  identifier: "PrepareManagedExecutionRequest",
  description:
    "Reserve an execution for an installed 1Claw-managed session key. Does not sign or broadcast.",
});
export const PrepareManagedExecutionResponse = Schema.Struct({
  ...Struct.omit(PrepareEvmExecutionResponse.fields, ["signing"]),
}).annotate({ identifier: "PrepareManagedExecutionResponse" });
export const CompleteManagedExecutionRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  submissionId: ExecutionSubmissionId,
}).annotate({
  identifier: "CompleteManagedExecutionRequest",
  description:
    "Sign and queue only the stored managed preparation. Retry this submission after uncertain responses.",
});
export type PrepareManagedExecutionResponse = typeof PrepareManagedExecutionResponse.Type;
export type PrepareManagedExecutionRequest = typeof PrepareManagedExecutionRequest.Type;
export type CompleteManagedExecutionRequest = typeof CompleteManagedExecutionRequest.Type;
