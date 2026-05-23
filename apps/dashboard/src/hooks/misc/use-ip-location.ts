import { useQuery } from "@tanstack/react-query";

import { queries } from "@/lib/query";

export const useIpLocation = (ipAddress?: string) => {
  return useQuery(queries.misc.ipLocation(ipAddress));
};
