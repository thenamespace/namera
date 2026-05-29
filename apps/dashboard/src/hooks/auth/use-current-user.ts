import { useAtomQuery } from "@/hooks/misc";
import { authAtoms } from "@/lib/atom";

export const useCurrentUser = () => {
  return useAtomQuery(authAtoms.me);
};
