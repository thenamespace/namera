import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { notificationPreferencesAtom } from "@/atoms/notification";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { useNotificationPreferences } from "@/hooks/notification";

import { NotificationPreferencesForm } from "./-components/notification-preferences-form";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });
    startPrefetchQuery(context.atomRegistry, notificationPreferencesAtom, abortController.signal);
    return { currentUser };
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { currentUser } = Route.useLoaderData();
  const preferences = useNotificationPreferences();

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
        {preferences.data ? (
          <NotificationPreferencesForm
            initialPreferences={preferences.data}
            organizationId={currentUser.organization.id}
          />
        ) : preferences.isError ? (
          <DataError
            label="notification preferences"
            onRetry={preferences.refetch}
            isRetrying={preferences.isFetching}
          />
        ) : (
          <DataLoading className="min-h-64" label="Loading notification preferences" />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
