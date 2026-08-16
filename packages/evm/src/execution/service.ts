import { makeExecutionClients } from "../clients/execution.js";
import type { EvmConfigValues } from "../config.js";
import { makePrepareEvmExecution } from "./prepare.js";
import {
  makeGetEvmExecutionReceipt,
  makeGetEvmUserOperationStatus,
  makeWaitForEvmExecutionReceipt,
} from "./receipt.js";
import { makeSignEvmExecution } from "./sign.js";
import { makeSubmitEvmExecution } from "./submit.js";
import type { EvmExecutionService } from "./types.js";

export const makeEvmExecutionService = (config: EvmConfigValues): EvmExecutionService => {
  // One service instance shares the cached public, Pimlico, and account clients
  // across every phase while keeping their large Viem types package-internal.
  const clients = makeExecutionClients(config);

  return {
    prepare: makePrepareEvmExecution(clients),
    sign: makeSignEvmExecution(clients),
    submit: makeSubmitEvmExecution(clients),
    getReceipt: makeGetEvmExecutionReceipt(clients),
    getStatus: makeGetEvmUserOperationStatus(clients),
    waitForReceipt: makeWaitForEvmExecutionReceipt(clients),
  };
};
