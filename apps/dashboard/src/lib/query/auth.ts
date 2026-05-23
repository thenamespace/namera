import { createQueryKeys } from "@lukemorales/query-key-factory";

import { getCurrentUser, listSessions } from "@/actions";

export const authQuery = createQueryKeys("auth", {
  me: {
    queryKey: ["me"],
    queryFn: () => getCurrentUser(),
  },
  listSessions: {
    queryKey: ["listSessions"],
    queryFn: () => listSessions(),
  },
});
