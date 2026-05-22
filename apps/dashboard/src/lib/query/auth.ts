import { createQueryKeys } from "@lukemorales/query-key-factory";

import { getCurrentUser } from "@/actions";

export const authQuery = createQueryKeys("auth", {
  me: {
    queryKey: ["me"],
    queryFn: () => getCurrentUser(),
  },
});
