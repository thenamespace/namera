import { authAtoms } from "@/lib/atom";

import { useAtomQuery } from "../misc";

export const useListUserOrgs = () => {
  return useAtomQuery(authAtoms.organization.listOrgsForUser);
};
