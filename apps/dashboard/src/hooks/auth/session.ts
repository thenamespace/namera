import {
  currentUserAtom,
  logoutMutation,
  revokeOtherSessionsMutation,
  sessionsAtom,
} from "@/atoms/auth/session";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useCurrentUser = toQuery(() => currentUserAtom);
export const useSessions = toQuery(() => sessionsAtom);

export const useLogout = toMutation(logoutMutation, {
  invalidates: [
    ...QueryKeys.session.current,
    ...QueryKeys.session.lists,
    ...QueryKeys.organization.active,
  ],
});

export const useRevokeOtherSessions = toMutation(revokeOtherSessionsMutation, {
  invalidates: QueryKeys.session.lists,
});
