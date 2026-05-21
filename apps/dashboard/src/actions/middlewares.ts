import { redirect } from "@tanstack/react-router";

import { getCurrentUser } from "./auth";

export const authMiddleware = async () => {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw redirect({ to: "/auth" });
  }

  if (!currentUser.organization) {
    throw redirect({ to: "/workspace/new" });
  }

  return currentUser;
};
