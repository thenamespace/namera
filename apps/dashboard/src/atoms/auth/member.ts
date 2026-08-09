import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const organizationMembersAtom = NameraClient.query("member", "listOrgMembers", {
  reactivityKeys: [...QueryKeys.organization.active, ...QueryKeys.member.lists],
  timeToLive: "30 seconds",
});
