import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom, sessionsAtom } from "@/atoms/auth/session";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { SecuritySessions } from "./-components/security-sessions";

export const Route = createFileRoute("/_authenticated/settings/security")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });
    startPrefetchQuery(context.atomRegistry, sessionsAtom, abortController.signal);
    return { currentUser };
  },
  component: SecurityPage,
});

function SecurityPage() {
  const { currentUser } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-10">
          <HeadingGroup.Title level={1} size="lg">
            Security
          </HeadingGroup.Title>
        </HeadingGroup>
        <SecuritySessions currentSessionId={currentUser.session.id} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
