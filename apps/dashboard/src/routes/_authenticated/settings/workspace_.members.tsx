import { createFileRoute } from "@tanstack/react-router";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { MembersTable } from "./-components/members-table";

export const Route = createFileRoute("/_authenticated/settings/workspace_/members")({
  component: MembersPage,
});

function MembersPage() {
  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            Members
          </HeadingGroup.Title>
        </HeadingGroup>
        <MembersTable />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
