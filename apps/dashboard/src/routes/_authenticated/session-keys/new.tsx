import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { billingAtom } from "@/atoms/billing";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { hasPermissions } from "@/components/permission";

import { CreateSessionKeyPage } from "./-components/create-session-key-page";
import { validateSessionCreationSearch } from "./-components/creation-search";

const sessionKeyCreatePermission = ["session-key:create"] as const;

export const Route = createFileRoute("/_authenticated/session-keys/new")({
  validateSearch: validateSessionCreationSearch,
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canCreate = hasPermissions(currentUser.role.permissions, sessionKeyCreatePermission);
    if (canCreate) startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);
    if (canCreate && hasPermissions(currentUser.role.permissions, ["billing:read"]))
      startPrefetchQuery(context.atomRegistry, billingAtom, abortController.signal);

    return { canCreate };
  },
  component: SessionKeyRoute,
});

function SessionKeyRoute() {
  const search = Route.useSearch();
  const { canCreate } = Route.useLoaderData();
  return <CreateSessionKeyPage canCreate={canCreate} {...search} />;
}
