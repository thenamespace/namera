import { authAtoms } from "@/lib/atom";

import { useAtomQuery } from "../misc";

export const useListSessions = () => {
  return useAtomQuery(authAtoms.listSessions);
};
