import { useQuery } from "@tanstack/react-query";

import { queries } from "@/lib/query";

export const useUserPreference = () => {
  return useQuery(queries.userPreference.get);
};
