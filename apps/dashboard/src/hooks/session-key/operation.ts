import { QueryKeys } from "@/atoms/query-keys";
import {
  activeSessionKeyOperationAtom,
  completeSessionKeyOperationMutation,
  prepareSessionKeyOperationMutation,
  sessionKeyOperationAtom,
  prepareManagedSessionKeyOperationMutation,
  approveManagedSessionKeyOperationMutation,
} from "@/atoms/session-key/operation";
import { toMutation, toQuery } from "@/hooks/atom";

export const useSessionKeyOperation = toQuery(sessionKeyOperationAtom);
export const useActiveSessionKeyOperation = toQuery(activeSessionKeyOperationAtom);

// The caller retains one idempotency key for a preparation attempt, including retries.
export const usePrepareSessionKeyOperation = toMutation(prepareSessionKeyOperationMutation);
export const usePrepareManagedSessionKeyOperation = toMutation(
  prepareManagedSessionKeyOperationMutation,
);
export const useApproveManagedSessionKeyOperation = toMutation(
  approveManagedSessionKeyOperationMutation,
  {
    invalidates: ({ payload }) => [
      ...QueryKeys.sessionKey.operation(payload.operationId),
      ...QueryKeys.sessionKey.all,
      ...QueryKeys.billing.current,
    ],
  },
);

export const useCompleteSessionKeyOperation = toMutation(completeSessionKeyOperationMutation, {
  invalidates: ({ payload }) => [
    ...QueryKeys.sessionKey.operation(payload.operationId),
    ...QueryKeys.sessionKey.all,
    ...QueryKeys.billing.current,
  ],
});
