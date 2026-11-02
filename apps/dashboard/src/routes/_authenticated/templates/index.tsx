import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/components/page";

import { TemplateList } from "./-components/template-list";

export const Route = createFileRoute("/_authenticated/templates/")({
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>Templates</DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        <TemplateList />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
