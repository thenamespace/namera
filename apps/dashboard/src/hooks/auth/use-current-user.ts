import { useQuery } from "@tanstack/react-query";

import { queries } from "@/lib/query";

export const useCurrentUser = () => {
  return useQuery(queries.auth.me);
};
