import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { prefetchQuery } from "@/atoms/prefetch";
import { walletSessionKeysAtom } from "@/atoms/session-key";
import { WalletSessionKeysTable } from "@/components/session-keys-table";

export const Route = createFileRoute("/_authenticated/account/$accountId/session-keys")({
  loader: async ({ abortController, context, params }) => {
    if (!Schema.is(WalletId)(params.accountId)) throw notFound();

    const sessionKeys = await prefetchQuery(
      context.atomRegistry,
      walletSessionKeysAtom(params.accountId),
      abortController.signal,
    );
    return { sessionKeys, walletId: params.accountId };
  },
  component: AccountSessionKeysPage,
});

function AccountSessionKeysPage() {
  const { sessionKeys, walletId } = Route.useLoaderData();
  return <WalletSessionKeysTable initialSessionKeys={sessionKeys} walletId={walletId} />;
}
