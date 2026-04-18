import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import { PageHeader } from "./-components";

const DashboardPage = () => {
  const res = useLoaderData({ from: "/dashboard" });
  return (
    <div>
      <PageHeader header="Dashboard" />
      <pre>{JSON.stringify(res, null, 2)}</pre>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
  errorComponent: () => <div>Some Error Occurred in dashboard</div>,
});
