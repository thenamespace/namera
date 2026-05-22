import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";
import { useListUserOrgs } from "@/hooks/organization";

const DashboardPage = () => {
  const { data } = useListUserOrgs();
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
