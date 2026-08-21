import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { startPrefetchQuery } from "@/atoms/prefetch";
import { walletPortfolioAtom } from "@/atoms/wallet";
import { DataLoading } from "@/components/data-loading";
import { useWallet } from "@/hooks/wallet";

import { AccountAssets } from "../-components/account-assets";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/_authenticated/account/$accountId/assets")({
  loader: ({ abortController, context, params }) => {
    if (!Schema.is(WalletId)(params.accountId)) throw notFound();

    startPrefetchQuery(
      context.atomRegistry,
      walletPortfolioAtom(params.accountId),
      abortController.signal,
    );
    return { accountId: params.accountId };
  },
  component: AccountAssetsPage,
});

function AccountAssetsPage() {
  const { accountId } = AccountRoute.useLoaderData();
  const account = useWallet(accountId);

  return account.data ? (
    <AccountAssets account={account.data} />
  ) : (
    <DataLoading className="min-h-64" label="Loading account assets" />
  );
}
