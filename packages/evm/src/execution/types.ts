import type { Effect, Option } from "effect";

import type {
  EvmExecutionError,
  EvmExecutionReceipt,
  EvmExecutionSponsorship,
  EvmPreparedExecution,
  EvmSignedExecution,
  EvmSubmittedExecution,
  EvmUserOperationStatus,
  UnsupportedChainError,
  UserOperationHash,
} from "@namera-ai/protocol";
import type { EvmIntentCall, SupportedEvmChainId } from "@namera-ai/protocol";

import type { ReconstructEvmAccountInput } from "../accounts/types.js";

export type PrepareEvmExecutionInput = {
  readonly chainId: SupportedEvmChainId;
  readonly account: ReconstructEvmAccountInput;
  readonly calls: ReadonlyArray<EvmIntentCall>;
  readonly sponsorship: EvmExecutionSponsorship;
};

export type SignEvmExecutionInput = {
  readonly account: ReconstructEvmAccountInput;
  readonly prepared: EvmPreparedExecution;
};

export type SubmitEvmExecutionInput = {
  readonly signed: EvmSignedExecution;
};

export type GetEvmExecutionReceiptInput = {
  readonly chainId: SupportedEvmChainId;
  readonly userOperationHash: UserOperationHash;
};

export type WaitForEvmExecutionReceiptInput = GetEvmExecutionReceiptInput & {
  readonly timeoutMilliseconds?: number;
};

type EvmExecutionFailure = EvmExecutionError | UnsupportedChainError;

export interface EvmExecutionService {
  readonly prepare: (
    input: PrepareEvmExecutionInput,
  ) => Effect.Effect<EvmPreparedExecution, EvmExecutionFailure>;
  readonly sign: (
    input: SignEvmExecutionInput,
  ) => Effect.Effect<EvmSignedExecution, EvmExecutionFailure>;
  readonly submit: (
    input: SubmitEvmExecutionInput,
  ) => Effect.Effect<EvmSubmittedExecution, EvmExecutionFailure>;
  readonly getReceipt: (
    input: GetEvmExecutionReceiptInput,
  ) => Effect.Effect<Option.Option<EvmExecutionReceipt>, EvmExecutionFailure>;
  readonly getStatus: (
    input: GetEvmExecutionReceiptInput,
  ) => Effect.Effect<EvmUserOperationStatus, EvmExecutionFailure>;
  readonly waitForReceipt: (
    input: WaitForEvmExecutionReceiptInput,
  ) => Effect.Effect<Option.Option<EvmExecutionReceipt>, EvmExecutionFailure>;
}
