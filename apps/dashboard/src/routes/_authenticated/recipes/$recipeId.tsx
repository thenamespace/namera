import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";

import { getRecipe } from "@namera-ai/recipes";

import { currentUserAtom } from "@/atoms/auth/session";
import { billingAtom } from "@/atoms/billing";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";
import { CreateSessionKeyForm } from "@/components/session-key-creation";
import { useWallets } from "@/hooks/wallet";

export const Route = createFileRoute("/_authenticated/recipes/$recipeId")({
  loader: async ({ params, context, abortController }) => {
    const recipe = getRecipe(params.recipeId);
    if (!recipe) throw notFound();
    const user = await prefetchQuery(context.atomRegistry, currentUserAtom, abortController.signal);
    if (!user) throw redirect({ to: "/auth", replace: true });
    const canCreate = hasPermissions(user.role.permissions, ["session-key:create"]);
    if (canCreate) startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);
    if (canCreate && hasPermissions(user.role.permissions, ["billing:read"]))
      startPrefetchQuery(context.atomRegistry, billingAtom, abortController.signal);
    return { recipeId: recipe.id, canCreate };
  },
  component: RecipePage,
});

function RecipePage() {
  const { recipeId, canCreate } = Route.useLoaderData();
  const recipe = getRecipe(recipeId);
  if (!recipe) throw notFound();
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <Link to="/recipes" className="text-muted hover:text-foreground">
            Recipes
          </Link>
          <span className="text-muted">/</span>
          {recipe.display.name}
        </DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        {canCreate ? <RecipeWithAccounts recipeId={recipeId} /> : <PermissionDenied />}
      </DashboardPage.Content>
    </DashboardPage>
  );
}

function RecipeWithAccounts({ recipeId }: { recipeId: string }) {
  const wallets = useWallets();
  const recipe = getRecipe(recipeId);
  if (!recipe) throw notFound();
  if (wallets.isError)
    return <DataError label="accounts" onRetry={wallets.refetch} isRetrying={wallets.isFetching} />;
  return wallets.data ? (
    <CreateSessionKeyForm key={recipeId} recipe={recipe} wallets={wallets.data} />
  ) : (
    <DataLoading label="Loading accounts" />
  );
}
