import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const ActivityPage = () => {
  return (
    <div>
      <PageHeader header="Activity" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/activity/")({
  component: ActivityPage,
});
