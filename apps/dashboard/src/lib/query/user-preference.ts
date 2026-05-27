import { createQueryKeys } from "@lukemorales/query-key-factory";

import { getUserPreferences } from "@/actions";

export const userPreferenceQuery = createQueryKeys("userPreference", {
  get: {
    queryKey: ["get"],
    queryFn: () => getUserPreferences(),
  },
});
