import { miscAtoms } from "@/lib/atom";

import { useAtomQuery } from "./use-atom-query";

export const useIpLocation = (ipAddress?: string) => {
  return useAtomQuery(miscAtoms.ipLocation(ipAddress));
};
