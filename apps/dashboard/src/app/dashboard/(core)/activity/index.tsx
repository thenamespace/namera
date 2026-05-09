import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Activity" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(core)/activity/")({
  component: Page,
});
