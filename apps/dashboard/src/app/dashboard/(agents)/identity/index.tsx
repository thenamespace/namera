import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Identity" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(agents)/identity/")({
  component: Page,
});
