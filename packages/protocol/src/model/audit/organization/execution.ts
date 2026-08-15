import { Schema } from "effect";

import { ExecutionId, ExecutionSubmissionId, SessionKeyGrantId } from "#/common/index";
import { SupportedEvmChainId, TransactionHash, UserOperationHash } from "#/evm/index";

export const ExecutionSubmittedEventData = Schema.Struct({
  event: Schema.Literal("execution.submitted"),
  resourceType: Schema.Literal("execution-submission"),
  resourceId: ExecutionSubmissionId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    namespace: Schema.Literal("eip155"),
    chainId: SupportedEvmChainId,
    sessionKeyGrantId: SessionKeyGrantId,
    userOperationHash: UserOperationHash,
  }),
});

export const ExecutionConfirmedEventData = Schema.Struct({
  event: Schema.Literal("execution.confirmed"),
  resourceType: Schema.Literal("execution"),
  resourceId: ExecutionId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    namespace: Schema.Literal("eip155"),
    chainId: SupportedEvmChainId,
    submissionId: ExecutionSubmissionId,
    transactionHash: TransactionHash,
    userOperationHash: UserOperationHash,
  }),
});

export const ExecutionFailedEventData = Schema.Struct({
  event: Schema.Literal("execution.failed"),
  resourceType: Schema.Literal("execution-submission"),
  resourceId: ExecutionSubmissionId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    namespace: Schema.Literal("eip155"),
    chainId: SupportedEvmChainId,
    stage: Schema.Literals(["prepare", "sign", "submit", "receipt"]),
  }),
});
