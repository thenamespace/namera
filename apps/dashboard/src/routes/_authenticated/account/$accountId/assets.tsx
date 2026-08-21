import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { prefetchQuery } from "@/atoms/prefetch";
import { walletPortfolioAtom } from "@/atoms/wallet";

import { AccountAssets } from "../-components/account-assets";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/_authenticated/account/$accountId/assets")({
  loader: async ({ abortController, context, params }) => {
    if (!Schema.is(WalletId)(params.accountId)) throw notFound();

    return {
      portfolio: await prefetchQuery(
        context.atomRegistry,
        walletPortfolioAtom(params.accountId),
        abortController.signal,
      ),
    };
  },
  component: AccountAssetsPage,
});

function AccountAssetsPage() {
  const { account } = AccountRoute.useLoaderData();
  const { portfolio } = Route.useLoaderData();

  return <AccountAssets account={account} initialPortfolio={portfolio} />;
}
