import type { Effect } from "effect";

import type {
  EvmExecutionError,
  EvmPreparedExecution,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import type { EvmIntentCall, SupportedEvmChainId } from "@namera-ai/protocol";

import type { ReconstructEvmAccountInput } from "../accounts/types.js";

export type PrepareEvmExecutionInput = {
  readonly chainId: SupportedEvmChainId;
  readonly account: ReconstructEvmAccountInput;
  readonly calls: ReadonlyArray<EvmIntentCall>;
};

export interface EvmExecutionService {
  readonly prepare: (
    input: PrepareEvmExecutionInput,
  ) => Effect.Effect<EvmPreparedExecution, EvmExecutionError | UnsupportedChainError>;
}
