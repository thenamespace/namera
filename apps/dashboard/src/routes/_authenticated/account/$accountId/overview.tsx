import { createFileRoute } from "@tanstack/react-router";

import { DataLoading } from "@/components/data-loading";
import { useWallet } from "@/hooks/wallet";

import { AccountOverview } from "../-components/account-overview";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/_authenticated/account/$accountId/overview")({
  component: AccountOverviewPage,
});

function AccountOverviewPage() {
  const { accountId } = AccountRoute.useLoaderData();
  const account = useWallet(accountId);

  return account.data ? (
    <AccountOverview account={account.data} />
  ) : (
    <DataLoading className="min-h-64" label="Loading account" />
  );
}
