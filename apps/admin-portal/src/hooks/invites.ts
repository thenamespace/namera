import type { ListBetaInvitesRequest } from "@namera-ai/protocol/dto";

import { invitesAtom, createInvitesMutation, revokeInviteMutation } from "@/atoms/invites";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useInvites = toQuery((query: ListBetaInvitesRequest) => invitesAtom(query));
export const useCreateInvites = toMutation(createInvitesMutation, {
  invalidates: QueryKeys.invites.list,
});
export const useRevokeInvite = toMutation(revokeInviteMutation, {
  invalidates: QueryKeys.invites.list,
});
