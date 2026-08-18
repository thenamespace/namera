import { createFileRoute } from "@tanstack/react-router";

import { AccountSectionPlaceholder } from "../-components/account-section-placeholder";

export const Route = createFileRoute("/_authenticated/account/$accountId/usage")({
  component: AccountUsagePage,
});

function AccountUsagePage() {
  return (
    <AccountSectionPlaceholder
      description="Execution and billing usage for this account will live here."
      title="Usage"
    />
  );
}
