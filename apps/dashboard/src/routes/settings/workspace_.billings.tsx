import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/components/page";

export const Route = createFileRoute("/settings/workspace_/billings")({
  component: DashboardPage,
});
