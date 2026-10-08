import type { ListBetaInvitesRequest } from "@namera-ai/protocol/dto";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const invitesAtom = (query: ListBetaInvitesRequest = {}) =>
  NameraClient.query("betaInvite", "list", {
    query: { limit: 25, ...query },
    reactivityKeys: QueryKeys.invites.list,
    timeToLive: "30 seconds",
  });
export const createInvitesMutation = NameraClient.mutation("betaInvite", "create");
export const revokeInviteMutation = NameraClient.mutation("betaInvite", "revoke");
