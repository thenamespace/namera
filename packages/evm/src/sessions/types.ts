import type { Effect } from "effect";

import type {
  EvmExecutionError,
  EvmExecutionSponsorship,
  EvmPreparedExecution,
  EvmSessionAuthorization,
  SupportedEvmChainId,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import type { EvmSessionInstallationData } from "@namera-ai/protocol/model";

import type { ReconstructEvmAccountInput } from "../accounts/types.js";

type SessionAccount = {
  readonly account: ReconstructEvmAccountInput;
  readonly chainId: SupportedEvmChainId;
};

export type CompileEvmSessionInput = SessionAccount & {
  readonly authorization: EvmSessionAuthorization;
};

export type PrepareEvmSessionOperationInput = SessionAccount & {
  readonly installation: EvmSessionInstallationData;
  readonly kind: "install" | "uninstall";
  readonly sponsorship: EvmExecutionSponsorship;
};

export interface EvmSessionService {
  readonly compile: (
    input: CompileEvmSessionInput,
  ) => Effect.Effect<EvmSessionInstallationData, EvmExecutionError | UnsupportedChainError>;
  readonly prepareOperation: (
    input: PrepareEvmSessionOperationInput,
  ) => Effect.Effect<EvmPreparedExecution, EvmExecutionError | UnsupportedChainError>;
}
