import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

import { AccountsTable, CreateAccountButton } from "./-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Accounts">
        <CreateAccountButton />
      </PageHeader>
      <AccountsTable />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(core)/accounts/")({
  component: Page,
});
