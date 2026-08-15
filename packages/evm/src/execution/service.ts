import { makeExecutionClients } from "../clients/execution.js";
import type { EvmConfigValues } from "../config.js";
import { makePrepareEvmExecution } from "./prepare.js";
import type { EvmExecutionService } from "./types.js";

export const makeEvmExecutionService = (config: EvmConfigValues): EvmExecutionService => ({
  prepare: makePrepareEvmExecution(makeExecutionClients(config)),
});
