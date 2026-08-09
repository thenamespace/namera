import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const currentUserAtom = NameraClient.query("session", "currentUser", {
  reactivityKeys: QueryKeys.session.current,
  timeToLive: "30 seconds",
});

export const sessionsAtom = NameraClient.query("session", "listSessions", {
  reactivityKeys: QueryKeys.session.lists,
  timeToLive: "30 seconds",
});

export const logoutMutation = NameraClient.mutation("session", "logout");

export const revokeOtherSessionsMutation = NameraClient.mutation("session", "revokeOtherSessions");
