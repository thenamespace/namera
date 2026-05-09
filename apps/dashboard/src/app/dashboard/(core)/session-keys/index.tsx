import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Session Keys" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(core)/session-keys/")({
  component: Page,
});
