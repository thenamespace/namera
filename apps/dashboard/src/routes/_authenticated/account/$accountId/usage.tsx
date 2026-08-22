import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { walletExecutionsAtom } from "@/atoms/execution";
import { startPrefetchQuery } from "@/atoms/prefetch";
import { WalletExecutionsTable } from "@/components/executions-table";

export const Route = createFileRoute("/_authenticated/account/$accountId/usage")({
  loader: ({ abortController, context, params }) => {
    if (!Schema.is(WalletId)(params.accountId)) throw notFound();

    startPrefetchQuery(
      context.atomRegistry,
      walletExecutionsAtom(params.accountId),
      abortController.signal,
    );
    return { walletId: params.accountId };
  },
  component: AccountUsagePage,
});

function AccountUsagePage() {
  const { walletId } = Route.useLoaderData();
  return <WalletExecutionsTable walletId={walletId} />;
}
