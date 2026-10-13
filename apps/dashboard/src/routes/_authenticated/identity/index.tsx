import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { currentUserAtom } from "@/atoms/auth/session";
import {
  identitiesAtom,
  identityAtom,
  identityNetworksAtom,
  identityPrimaryAtom,
} from "@/atoms/identity";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { walletsAtom, walletPasskeyOwnerAtom } from "@/atoms/wallet";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";

import { IdentityHome } from "./-components/identity-list";

const Search = Schema.Struct({
  account: Schema.optional(WalletId),
  page: Schema.optional(Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))),
});
export const Route = createFileRoute("/_authenticated/identity/")({
  validateSearch: (search: Record<string, unknown>): typeof Search.Type =>
    Schema.decodeUnknownSync(Search)(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, abortController, deps }) => {
    const actor = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (!actor) throw redirect({ to: "/auth" });
    const wallets = await prefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);
    const active = wallets.filter((wallet) => wallet.status === "active");
    const selected = active.find((wallet) => wallet.id === deps.account) ?? active[0];
    if (selected) {
      const names = await prefetchQuery(
        context.atomRegistry,
        identitiesAtom(selected.id),
        abortController.signal,
      );
      const identity = names.items[0];
      if (identity) {
        startPrefetchQuery(
          context.atomRegistry,
          identityPrimaryAtom(selected.id, identity.label),
          abortController.signal,
        );
        startPrefetchQuery(
          context.atomRegistry,
          walletPasskeyOwnerAtom(selected.id),
          abortController.signal,
        );
        await Promise.all([
          prefetchQuery(
            context.atomRegistry,
            identityAtom(selected.id, identity.label),
            abortController.signal,
          ),
          prefetchQuery(context.atomRegistry, identityNetworksAtom, abortController.signal),
        ]);
      }
    }
    return {
      wallets: active,
      selected,
      canEdit: hasPermissions(actor.role.permissions, ["wallet:update"]),
    };
  },
  component: IdentityPage,
});
function IdentityPage() {
  const data = Route.useLoaderData();
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>Identity</DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <IdentityHome {...data} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
