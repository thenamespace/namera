import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId, WalletNotFoundError } from "@namera-ai/protocol";

import { prefetchQuery } from "@/atoms/prefetch";
import { walletAtom } from "@/atoms/wallet";

import { AccountShell } from "../-components/account-shell";

export const Route = createFileRoute("/_authenticated/account/$accountId")({
  loader: async ({ abortController, context, params }) => {
    if (!Schema.is(WalletId)(params.accountId)) throw notFound();

    try {
      const account = await prefetchQuery(
        context.atomRegistry,
        walletAtom(params.accountId),
        abortController.signal,
      );
      return { account };
    } catch (error) {
      if (Schema.is(WalletNotFoundError)(error)) throw notFound();
      throw error;
    }
  },
  component: AccountLayout,
});

function AccountLayout() {
  const { account } = Route.useLoaderData();
  return (
    <AccountShell account={account}>
      <Outlet />
    </AccountShell>
  );
}
