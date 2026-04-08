import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Identity" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/identity/")({
  component: Page,
});
