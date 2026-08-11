import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/components/page";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>Overview</DashboardPage.Title>
        <DashboardPage.Side>side</DashboardPage.Side>
      </DashboardPage.Header>
      <DashboardPage.Content>content</DashboardPage.Content>
    </DashboardPage>
  );
}
