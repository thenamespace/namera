import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { startPrefetchQuery } from "@/atoms/prefetch";
import { walletSessionKeysAtom } from "@/atoms/session-key";
import { WalletSessionKeysTable } from "@/components/session-keys-table";

export const Route = createFileRoute("/_authenticated/account/$accountId/session-keys")({
  loader: ({ abortController, context, params }) => {
    if (!Schema.is(WalletId)(params.accountId)) throw notFound();

    startPrefetchQuery(
      context.atomRegistry,
      walletSessionKeysAtom(params.accountId),
      abortController.signal,
    );
    return { walletId: params.accountId };
  },
  component: AccountSessionKeysPage,
});

function AccountSessionKeysPage() {
  const { walletId } = Route.useLoaderData();
  return <WalletSessionKeysTable walletId={walletId} />;
}
