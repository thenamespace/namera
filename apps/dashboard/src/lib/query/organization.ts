import { createQueryKeys } from "@lukemorales/query-key-factory";

import { listUserOrgs } from "@/actions/auth/organization";

export const organizationQuery = createQueryKeys("organization", {
  listUserOrgs: {
    queryKey: ["listUserOrgs"],
    queryFn: () => listUserOrgs(),
  },
});
