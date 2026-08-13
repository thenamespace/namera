import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";

export const Route = createFileRoute("/auth")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );

    if (currentUser !== null) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: Outlet,
});
