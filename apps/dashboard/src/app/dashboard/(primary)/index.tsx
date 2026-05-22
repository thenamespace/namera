import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";
import { useCurrentUser } from "@/hooks/auth";

const DashboardPage = () => {
  const { data } = useCurrentUser();
  return (
    <div>
      <PageHeader header="Dashboard" />
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(primary)/")({
  component: DashboardPage,
  errorComponent: () => <div>Some Error Occurred in dashboard</div>,
});
