import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { prefetchQuery } from "@/atoms/prefetch";

export const Route = createFileRoute("/")({
  loader: async ({ context, abortController }) => {
    context.atomRegistry.refresh(currentAdminAtom);
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (access.status !== "authorized") throw redirect({ to: "/auth", replace: true });
  },
  component: () => null,
});
