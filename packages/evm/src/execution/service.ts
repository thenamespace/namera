import { makeExecutionClients } from "../clients/execution.js";
import type { EvmConfigValues } from "../config.js";
import { makePrepareEvmExecution } from "./prepare.js";
import { makeGetEvmExecutionReceipt, makeWaitForEvmExecutionReceipt } from "./receipt.js";
import { makeSignEvmExecution } from "./sign.js";
import { makeSubmitEvmExecution } from "./submit.js";
import type { EvmExecutionService } from "./types.js";

export const makeEvmExecutionService = (config: EvmConfigValues): EvmExecutionService => {
  const clients = makeExecutionClients(config);

  return {
    prepare: makePrepareEvmExecution(clients),
    sign: makeSignEvmExecution(clients),
    submit: makeSubmitEvmExecution(clients),
    getReceipt: makeGetEvmExecutionReceipt(clients),
    waitForReceipt: makeWaitForEvmExecutionReceipt(clients),
  };
};
