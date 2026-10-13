import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { EnsLabel, WalletId } from "@namera-ai/protocol";

import { currentUserAtom } from "@/atoms/auth/session";
import { identityAtom, identityNetworksAtom, identityPrimaryAtom } from "@/atoms/identity";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { walletAtom, walletPasskeyOwnerAtom } from "@/atoms/wallet";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";

import { IdentityProfile } from "../-components/identity-profile";

export const Route = createFileRoute("/_authenticated/identity/$accountId/$label")({
  params: {
    parse: (params) =>
      Schema.decodeUnknownSync(Schema.Struct({ accountId: WalletId, label: EnsLabel }))(params),
  },
  loader: async ({ context, abortController, params }) => {
    const actor = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (!actor) throw redirect({ to: "/auth" });
    startPrefetchQuery(
      context.atomRegistry,
      identityPrimaryAtom(params.accountId, params.label),
      abortController.signal,
    );
    startPrefetchQuery(
      context.atomRegistry,
      walletPasskeyOwnerAtom(params.accountId),
      abortController.signal,
    );
    const [wallet] = await Promise.all([
      prefetchQuery(context.atomRegistry, walletAtom(params.accountId), abortController.signal),
      prefetchQuery(
        context.atomRegistry,
        identityAtom(params.accountId, params.label),
        abortController.signal,
      ),
      prefetchQuery(context.atomRegistry, identityNetworksAtom, abortController.signal),
    ]);
    return { wallet, canEdit: hasPermissions(actor.role.permissions, ["wallet:update"]) };
  },
  component: IdentityDetailPage,
});
function IdentityDetailPage() {
  const { wallet, canEdit } = Route.useLoaderData();
  const { label } = Route.useParams();
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>Identity</DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <IdentityProfile
          key={`${wallet.id}:${label}`}
          wallet={wallet}
          label={label}
          canEdit={canEdit}
        />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
