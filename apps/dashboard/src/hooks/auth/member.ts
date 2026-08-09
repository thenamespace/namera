import { organizationMembersAtom } from "@/atoms/auth/member";
import { toQuery } from "@/hooks/atom";

export const useOrganizationMembers = toQuery(() => organizationMembersAtom);
