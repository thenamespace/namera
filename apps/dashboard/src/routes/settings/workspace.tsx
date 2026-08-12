import { createFileRoute } from "@tanstack/react-router";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { WorkspaceForm } from "./-components/workspace-form";

export const Route = createFileRoute("/settings/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            Workspace
          </HeadingGroup.Title>
        </HeadingGroup>
        <WorkspaceForm />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
