import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/components/page";

export const Route = createFileRoute("/_authenticated/identity")({
  component: DashboardPage,
});
