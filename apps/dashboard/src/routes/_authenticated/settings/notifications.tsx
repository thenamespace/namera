import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { notificationPreferencesAtom } from "@/atoms/notification";
import { prefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { NotificationPreferencesForm } from "./-components/notification-preferences-form";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  loader: async ({ abortController, context }) => {
    const [currentUser, preferences] = await Promise.all([
      prefetchQuery(context.atomRegistry, currentUserAtom, abortController.signal),
      prefetchQuery(context.atomRegistry, notificationPreferencesAtom, abortController.signal),
    ]);
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });
    return { currentUser, preferences };
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { currentUser, preferences } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            Notifications
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Choose which important account and organization updates you receive by email.
          </HeadingGroup.Description>
        </HeadingGroup>
        <NotificationPreferencesForm
          initialPreferences={preferences}
          organizationId={currentUser.organization.id}
        />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
