import { useQuery } from "@tanstack/react-query";

import { queries } from "@/lib/query";

export const useListSessions = () => {
  return useQuery(queries.auth.listSessions);
};
