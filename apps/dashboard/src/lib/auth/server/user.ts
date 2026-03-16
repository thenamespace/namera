import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getAuthToken } from "./token";

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const token = getAuthToken();

    if (!token) return redirect({ to: "/auth" });

    return await Promise.resolve({
      id: "1",
      name: "vedant",
    });
  },
);
