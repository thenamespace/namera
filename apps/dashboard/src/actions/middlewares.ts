import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { queries } from "@/lib/query";

export const authMiddleware = async (queryClient: QueryClient) => {
  const currentUser = await queryClient.ensureQueryData(queries.auth.me);
  if (!currentUser) {
    throw redirect({ to: "/auth" });
  }

  if (!currentUser.organization) {
    throw redirect({ to: "/workspace/new" });
  }

  return currentUser;
};
