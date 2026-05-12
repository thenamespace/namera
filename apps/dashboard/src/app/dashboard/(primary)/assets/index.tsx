import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Assets" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(primary)/assets/")({
  component: Page,
});
