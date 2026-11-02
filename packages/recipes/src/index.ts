import { ensRegistrationRecipe } from "./recipes/ens-registration/index.js";
import { ensRenewalRecipe } from "./recipes/ens-renewal/index.js";
import { usdcAllowanceRecipe } from "./recipes/usdc-allowance/index.js";

export type { Recipe, RecipeField, RecipeOutput, RecipeToken } from "./definition.js";
export { ensRegistrationRecipe, ensRenewalRecipe, usdcAllowanceRecipe };

export const recipes = [usdcAllowanceRecipe, ensRenewalRecipe, ensRegistrationRecipe] as const;
export type RegisteredRecipe = (typeof recipes)[number];

export function getRecipe(id: string): RegisteredRecipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}
