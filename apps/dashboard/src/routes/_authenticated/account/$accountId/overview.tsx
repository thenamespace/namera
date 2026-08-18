import { createFileRoute } from "@tanstack/react-router";

import { AccountOverview } from "../-components/account-overview";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/_authenticated/account/$accountId/overview")({
  component: AccountOverviewPage,
});

function AccountOverviewPage() {
  const { account } = AccountRoute.useLoaderData();
  return <AccountOverview account={account} />;
}
