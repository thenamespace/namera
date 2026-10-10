import { DateTime, Effect } from "effect";

import type {
  ApproveManagedSessionKeyOperationRequest,
  PrepareManagedSessionKeyOperationResponse,
} from "@namera-ai/protocol/dto";
import { validateManagedOwnerApproval, type ReviewedManagedOwnerOperation } from "@namera-ai/sdk";

/** Confirmation authorizes only this reviewed operation, and never outlives its expiry. */
export async function confirmManagedApproval({
  reviewed,
  response,
  signal,
  requestConfirmation,
  approve,
}: {
  readonly reviewed: ReviewedManagedOwnerOperation;
  readonly response: PrepareManagedSessionKeyOperationResponse;
  readonly signal: AbortSignal;
  readonly requestConfirmation: () => Promise<boolean>;
  readonly approve: (payload: ApproveManagedSessionKeyOperationRequest) => Promise<unknown>;
}) {
  if (signal.aborted) return false;
  validateManagedOwnerApproval({ reviewed, response, now: Effect.runSync(DateTime.now) });
  if (!(await requestConfirmation()) || signal.aborted) return false;
  validateManagedOwnerApproval({ reviewed, response, now: Effect.runSync(DateTime.now) });
  await approve({ operationId: response.operationId });
  return true;
}
