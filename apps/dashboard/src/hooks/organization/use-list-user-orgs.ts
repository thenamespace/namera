import { useQuery } from "@tanstack/react-query";

import { queries } from "@/lib/query";

export const useListUserOrgs = () => {
  return useQuery({
    ...queries.organization.listUserOrgs,
    initialData: [],
  });
};
