import { createFileRoute } from "@tanstack/react-router";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { NotificationPreferencesForm } from "./-components/notification-preferences-form";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
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
        <NotificationPreferencesForm />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
