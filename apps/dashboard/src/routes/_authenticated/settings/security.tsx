import { createFileRoute } from "@tanstack/react-router";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { SecuritySessions } from "./-components/security-sessions";

export const Route = createFileRoute("/_authenticated/settings/security")({
  component: SecurityPage,
});

function SecurityPage() {
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
        <SecuritySessions />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
