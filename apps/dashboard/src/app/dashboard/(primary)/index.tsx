import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

const DashboardPage = () => {
  return (
    <div>
      <PageHeader header="Dashboard" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(primary)/")({
  component: DashboardPage,
  errorComponent: () => <div>Some Error Occurred in dashboard</div>,
});
