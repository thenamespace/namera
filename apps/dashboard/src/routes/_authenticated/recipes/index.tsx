import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/components/page";

import { RecipeList } from "./-components/recipe-list";

export const Route = createFileRoute("/_authenticated/recipes/")({
  component: RecipesPage,
});

function RecipesPage() {
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>Recipes</DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <RecipeList />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
