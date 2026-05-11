import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Templates" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(core)/templates/")({
  component: Page,
});
