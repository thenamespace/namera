import { createFileRoute } from "@tanstack/react-router";

import { AccountSectionPlaceholder } from "../-components/account-section-placeholder";

export const Route = createFileRoute("/_authenticated/account/$accountId/session-keys")({
  component: AccountSessionKeysPage,
});

function AccountSessionKeysPage() {
  return (
    <AccountSectionPlaceholder
      description="Account-scoped session-key management will live here."
      title="Session Keys"
    />
  );
}
