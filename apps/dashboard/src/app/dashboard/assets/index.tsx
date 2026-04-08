import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Assets" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/assets/")({
  component: Page,
});
