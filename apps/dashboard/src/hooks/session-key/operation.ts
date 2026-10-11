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
export const usePrepareSessionKeyOperation = toMutation(prepareSessionKeyOperationMutation, {
  analyticsAction: "session_installation_prepare",
});
export const usePrepareManagedSessionKeyOperation = toMutation(
  prepareManagedSessionKeyOperationMutation,
  { analyticsAction: "session_installation_prepare" },
);
export const useApproveManagedSessionKeyOperation = toMutation(
  approveManagedSessionKeyOperationMutation,
  {
    analyticsAction: "session_installation_approve",
    invalidates: ({ payload }) => [
      ...QueryKeys.sessionKey.operation(payload.operationId),
      ...QueryKeys.sessionKey.all,
      ...QueryKeys.billing.current,
    ],
  },
);

export const useCompleteSessionKeyOperation = toMutation(completeSessionKeyOperationMutation, {
  analyticsAction: "session_installation_approve",
  invalidates: ({ payload }) => [
    ...QueryKeys.sessionKey.operation(payload.operationId),
    ...QueryKeys.sessionKey.all,
    ...QueryKeys.billing.current,
  ],
});
