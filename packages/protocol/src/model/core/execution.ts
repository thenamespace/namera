import { Schema, Struct } from "effect";

import {
  ExecutionId,
  ExecutionSubmissionId,
  OrganizationId,
  SessionKeyGrantId,
} from "#/common/index";
import { SupportedEvmChainId, TransactionHash, UserOperationHash } from "#/evm/index";
import { createInsertSchema } from "#/model/helpers";
import { EvmIntentCall } from "#/policy/evm/index";

export const EvmExecutionData = Schema.Struct({
  version: Schema.Literal(1),
  chainId: SupportedEvmChainId,
  calls: Schema.Array(EvmIntentCall),
  userOperationHash: UserOperationHash,
  transactionHash: TransactionHash,
});

const ExecutionCommon = Schema.Struct({
  id: ExecutionId,
  executionSubmissionId: ExecutionSubmissionId,
  organizationId: OrganizationId,
  sessionKeyGrantId: SessionKeyGrantId,
  createdAt: Schema.DateTimeUtcFromDate,
});

export const EvmExecution = ExecutionCommon.mapFields(
  Struct.assign({
    namespace: Schema.Literal("eip155"),
    data: EvmExecutionData,
  }),
);

export const Execution = Schema.Union([EvmExecution]);

export const ExecutionInsert = createInsertSchema(
  Execution,
  "executionSubmissionId",
  "organizationId",
  "sessionKeyGrantId",
  "namespace",
  "data",
);

export type EvmExecutionData = typeof EvmExecutionData.Type;
export type EvmExecution = typeof EvmExecution.Type;
export type Execution = typeof Execution.Type;
export type ExecutionEncoded = typeof Execution.Encoded;
export type ExecutionInsert = typeof ExecutionInsert.Type;
