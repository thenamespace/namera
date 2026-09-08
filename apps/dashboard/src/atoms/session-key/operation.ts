import type { SessionKeyOperationId } from "@namera-ai/protocol";
import type { GetActiveSessionKeyOperationRequest } from "@namera-ai/protocol/dto";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const activeSessionKeyOperationAtom = (params: GetActiveSessionKeyOperationRequest) =>
  NameraClient.query("sessionKey", "getActiveOperation", {
    params,
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.session.current,
      ...QueryKeys.sessionKey.all,
      ...QueryKeys.sessionKey.operations,
    ],
    timeToLive: "5 seconds",
  });

export const sessionKeyOperationAtom = (operationId: SessionKeyOperationId) =>
  NameraClient.query("sessionKey", "getOperation", {
    params: { operationId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.sessionKey.operations,
      ...QueryKeys.sessionKey.operation(operationId),
    ],
    timeToLive: "5 seconds",
  });

export const prepareSessionKeyOperationMutation = NameraClient.mutation(
  "sessionKey",
  "prepareOperation",
);
export const completeSessionKeyOperationMutation = NameraClient.mutation(
  "sessionKey",
  "completeOperation",
);
