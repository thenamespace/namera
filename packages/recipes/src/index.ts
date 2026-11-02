import { ensRegistrationRecipe } from "./recipes/ens-registration/index.js";
import { ensRenewalRecipe } from "./recipes/ens-renewal/index.js";
import { ensSubnameIssuerRecipe } from "./recipes/ens-subname-issuer/index.js";
import { usdcAllowanceRecipe } from "./recipes/usdc-allowance/index.js";

export type { Recipe, RecipeField, RecipeOutput, RecipeToken } from "./definition.js";
export { ensRegistrationRecipe, ensRenewalRecipe, ensSubnameIssuerRecipe, usdcAllowanceRecipe };

export const recipes = [
  usdcAllowanceRecipe,
  ensRenewalRecipe,
  ensRegistrationRecipe,
  ensSubnameIssuerRecipe,
] as const;
export type RegisteredRecipe = (typeof recipes)[number];

export function getRecipe(id: string): RegisteredRecipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}
