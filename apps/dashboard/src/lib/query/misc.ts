import { createQueryKeys } from "@lukemorales/query-key-factory";

import { getIpLocation } from "@/actions/misc";

export const miscQuery = createQueryKeys("misc", {
  ipLocation: (ipAddress?: string) => ({
    queryKey: ["ipLocation", ipAddress],
    queryFn: () => getIpLocation(ipAddress),
  }),
});
