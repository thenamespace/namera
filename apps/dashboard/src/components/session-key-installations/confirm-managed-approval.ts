import { DateTime, Effect } from "effect";

import type {
  ApproveManagedSessionKeyOperationRequest,
  PrepareManagedSessionKeyOperationResponse,
} from "@namera-ai/protocol/dto";
import { validateManagedOwnerApproval, type ReviewedManagedOwnerOperation } from "@namera-ai/sdk";

/** Installation uses the initial approval click; removal needs a second confirmation. */
export async function confirmManagedApproval({
  kind,
  reviewed,
  response,
  signal,
  requestConfirmation,
  approve,
}: {
  readonly kind: "install" | "uninstall";
  readonly reviewed: ReviewedManagedOwnerOperation;
  readonly response: PrepareManagedSessionKeyOperationResponse;
  readonly signal: AbortSignal;
  readonly requestConfirmation: () => Promise<boolean>;
  readonly approve: (payload: ApproveManagedSessionKeyOperationRequest) => Promise<unknown>;
}) {
  if (signal.aborted) return false;
  validateManagedOwnerApproval({ reviewed, response, now: Effect.runSync(DateTime.now) });
  if (kind === "uninstall") {
    if (!(await requestConfirmation()) || signal.aborted) return false;
    validateManagedOwnerApproval({ reviewed, response, now: Effect.runSync(DateTime.now) });
  }
  await approve({ operationId: response.operationId });
  return true;
}
