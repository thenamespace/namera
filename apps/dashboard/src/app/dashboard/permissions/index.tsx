import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Permissions" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/permissions/")({
  component: Page,
});
