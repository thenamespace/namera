import { useAtomQuery } from "@/hooks/misc";
import { coreAtoms } from "@/lib/atom";

export const useUserPreference = () => {
  return useAtomQuery(coreAtoms.userPreferences.get);
};
