import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { walletAtom } from "@/atoms/wallet";
import { hasPermissions } from "@/components/permission";

import { validateAccountCreationSearch } from "../-components/creation-search";
import { AccountCreated } from "./-components/account-created";

export const Route = createFileRoute("/_authenticated/accounts/created/$accountId")({
  validateSearch: validateAccountCreationSearch,
  loader: async ({ context, params, abortController }) => {
    if (!Schema.is(WalletId)(params.accountId)) throw notFound();
    const [account, user] = await Promise.all([
      prefetchQuery(context.atomRegistry, walletAtom(params.accountId), abortController.signal),
      prefetchQuery(context.atomRegistry, currentUserAtom, abortController.signal),
    ]);
    return {
      account,
      canCreateSessionKey: hasPermissions(user?.role.permissions ?? [], ["session-key:create"]),
    };
  },
  component: AccountCreatedPage,
});
function AccountCreatedPage() {
  const { from } = Route.useSearch();
  return <AccountCreated {...Route.useLoaderData()} onboarding={from === "get-started"} />;
}
