import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Security" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/security/")({
  component: Page,
});
