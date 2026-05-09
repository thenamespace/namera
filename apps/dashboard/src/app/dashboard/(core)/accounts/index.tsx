import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

import { CreateAccountButton } from "./-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Accounts">
        <CreateAccountButton />
      </PageHeader>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(core)/accounts/")({
  component: Page,
});
