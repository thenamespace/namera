import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { startPrefetchQuery } from "@/atoms/prefetch";
import { walletAtom } from "@/atoms/wallet";
import { useWallet } from "@/hooks/wallet";

import { AccountShell } from "../-components/account-shell";

export const Route = createFileRoute("/_authenticated/account/$accountId")({
  loader: ({ abortController, context, params }) => {
    if (!Schema.is(WalletId)(params.accountId)) throw notFound();

    startPrefetchQuery(context.atomRegistry, walletAtom(params.accountId), abortController.signal);
    return { accountId: params.accountId };
  },
  component: AccountLayout,
});

function AccountLayout() {
  const { accountId } = Route.useLoaderData();
  const account = useWallet(accountId);
  return (
    <AccountShell account={account.data}>
      <Outlet />
    </AccountShell>
  );
}
