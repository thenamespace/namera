import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

import { CreateSessionKeyButton } from "./-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Session Keys">
        <CreateSessionKeyButton />
      </PageHeader>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(core)/session-keys/")({
  component: Page,
});
