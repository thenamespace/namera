import { usdcAllowanceRecipe } from "./recipes/usdc-allowance/index.js";

export type { Recipe, RecipeField, RecipeOutput } from "./definition.js";
export { usdcAllowanceRecipe };

export const recipes = [usdcAllowanceRecipe] as const;
export type RegisteredRecipe = (typeof recipes)[number];

export function getRecipe(id: string): RegisteredRecipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}
