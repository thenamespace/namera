import type { OrganizationId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const userOrganizationsAtom = NameraClient.query("organization", "list", {
  reactivityKeys: [...QueryKeys.organization.all, ...QueryKeys.organization.lists],
  timeToLive: "30 seconds",
});

export const organizationAtom = (organizationId: OrganizationId) =>
  NameraClient.query("organization", "getOrganization", {
    query: { organizationId },
    reactivityKeys: [
      ...QueryKeys.organization.all,
      ...QueryKeys.organization.details,
      ...QueryKeys.organization.detail(organizationId),
    ],
    timeToLive: "30 seconds",
  });

export const createOrganizationMutation = NameraClient.mutation("organization", "create");
export const switchOrganizationMutation = NameraClient.mutation("organization", "setActive");
export const updateOrganizationMutation = NameraClient.mutation("organization", "update");
