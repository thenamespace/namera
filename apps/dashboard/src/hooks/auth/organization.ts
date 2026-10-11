import {
  createOrganizationMutation,
  organizationAtom,
  switchOrganizationMutation,
  updateOrganizationMutation,
  userOrganizationsAtom,
} from "@/atoms/auth/organization";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useUserOrganizations = toQuery(() => userOrganizationsAtom);
export const useOrganization = toQuery(organizationAtom);

export const useCreateOrganization = toMutation(createOrganizationMutation, {
  analyticsAction: "workspace_create",
  invalidates: [
    ...QueryKeys.session.current,
    ...QueryKeys.session.lists,
    ...QueryKeys.organization.active,
    ...QueryKeys.organization.lists,
  ],
});

export const useSwitchOrganization = toMutation(switchOrganizationMutation, {
  analyticsAction: "workspace_switch",
  invalidates: [
    ...QueryKeys.session.current,
    ...QueryKeys.session.lists,
    ...QueryKeys.organization.active,
  ],
});

export const useUpdateOrganization = toMutation(updateOrganizationMutation, {
  analyticsAction: "workspace_update",
  invalidates: [
    ...QueryKeys.session.current,
    ...QueryKeys.organization.active,
    ...QueryKeys.organization.lists,
    ...QueryKeys.organization.details,
  ],
});
