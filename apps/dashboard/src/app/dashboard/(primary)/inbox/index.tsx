import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Inbox" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(primary)/inbox/")({
  component: Page,
});
