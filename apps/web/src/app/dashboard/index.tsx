import { createFileRoute } from "@tanstack/react-router";

const DashboardPage = () => {
  return <div className="p-4">Dashboard</div>;
};

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});
