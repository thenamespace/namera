import type { HttpClient } from "effect/http";

import { makeEvmGasPrice } from "../billing/pricing.js";
import { makeExecutionClients } from "../clients/execution.js";
import type { EvmConfigValues } from "../config.js";
import { makeEvmOwnerApproval } from "./owner-approval.js";
import { makePrepareEvmExecution } from "./prepare.js";
import {
  makeGetEvmExecutionReceipt,
  makeGetEvmUserOperationStatus,
  makeWaitForEvmExecutionReceipt,
} from "./receipt.js";
import { makeEvmSessionSignature } from "./session-signature.js";
import { makeSignEvmExecution } from "./sign.js";
import { makeSubmitEvmExecution } from "./submit.js";
import type { EvmExecutionService } from "./types.js";

export const makeEvmExecutionService = (
  config: EvmConfigValues,
  httpClient: HttpClient.HttpClient,
): EvmExecutionService => {
  // One service instance shares cached Alchemy public, regular bundler, BSO
  // submission, and account clients
  // across every phase while keeping their large Viem types package-internal.
  const clients = makeExecutionClients(config);
  const ownerApproval = makeEvmOwnerApproval(clients);
  const sessionSignature = makeEvmSessionSignature(clients);

  return {
    sessionSigningMessage: sessionSignature.message,
    completeSessionExecution: sessionSignature.complete,
    prepare: makePrepareEvmExecution(clients, makeEvmGasPrice(config, httpClient)),
    sign: makeSignEvmExecution(clients),
    ownerApprovalChallenge: ownerApproval.challenge,
    completeOwnerApproval: ownerApproval.complete,
    submit: makeSubmitEvmExecution(clients),
    getReceipt: makeGetEvmExecutionReceipt(clients),
    getStatus: makeGetEvmUserOperationStatus(clients),
    waitForReceipt: makeWaitForEvmExecutionReceipt(clients),
  };
};
