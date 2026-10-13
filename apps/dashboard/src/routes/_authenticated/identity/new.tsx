import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";
import { buttonVariants, Typography } from "@namera-ai/ui";

import { currentUserAtom } from "@/atoms/auth/session";
import { identitiesAtom } from "@/atoms/identity";
import { prefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";

import { CreateIdentityFormCard } from "./-components/create-identity-form";

const Search = Schema.Struct({ account: Schema.optional(WalletId) });
export const Route = createFileRoute("/_authenticated/identity/new")({
  validateSearch: (search: Record<string, unknown>): typeof Search.Type =>
    Schema.decodeUnknownSync(Search)(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, abortController, deps }) => {
    const actor = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (!actor) throw redirect({ to: "/auth", replace: true });
    const canCreate = hasPermissions(actor.role.permissions, ["wallet:update"]);
    const wallets = canCreate
      ? (await prefetchQuery(context.atomRegistry, walletsAtom, abortController.signal)).filter(
          (wallet) => wallet.status === "active",
        )
      : [];
    const initialAccount = wallets.find((wallet) => wallet.id === deps.account)?.id;
    if (initialAccount) {
      const identities = await prefetchQuery(
        context.atomRegistry,
        identitiesAtom(initialAccount),
        abortController.signal,
      );
      if (identities.items.length)
        throw redirect({ to: "/identity", search: { account: initialAccount }, replace: true });
    }
    return {
      canCreate,
      wallets,
      initialAccount,
    };
  },
  component: CreateIdentityPage,
});
function CreateIdentityPage() {
  const { canCreate, wallets, initialAccount } = Route.useLoaderData();
  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 md:py-16">
        {canCreate ? (
          <>
            <HeadingGroup className="mb-6">
              <HeadingGroup.Title level={1} size="md">
                Create identity
              </HeadingGroup.Title>
              <HeadingGroup.Description>
                Give your account a namera.id name and public profile.
              </HeadingGroup.Description>
            </HeadingGroup>
            {wallets.length ? (
              <CreateIdentityFormCard
                key={initialAccount ?? "new"}
                wallets={wallets}
                initialAccount={initialAccount}
              />
            ) : (
              <div className="grid justify-items-start gap-4">
                <Typography className="text-muted">
                  Create an active account before giving it an identity.
                </Typography>
                <Link to="/accounts" className={buttonVariants({ variant: "secondary" })}>
                  View accounts
                </Link>
              </div>
            )}
          </>
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
