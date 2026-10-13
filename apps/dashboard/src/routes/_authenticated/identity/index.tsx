import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { currentUserAtom } from "@/atoms/auth/session";
import { identitiesAtom } from "@/atoms/identity";
import { prefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";

import { IdentityList } from "./-components/identity-list";

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
    if (selected)
      await prefetchQuery(
        context.atomRegistry,
        identitiesAtom(selected.id, deps.page ?? 1),
        abortController.signal,
      );
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
  const search = Route.useSearch();
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>Identity</DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        <IdentityList {...data} page={search.page ?? 1} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
