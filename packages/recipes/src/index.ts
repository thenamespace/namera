import { ensRegistrationRecipe } from "./recipes/ens-registration/index.js";
import { ensRenewalRecipe } from "./recipes/ens-renewal/index.js";
import { ensSubnameIssuerRecipe } from "./recipes/ens-subname-issuer/index.js";
import { uniswapV3SwapsRecipe } from "./recipes/uniswap-v3-swaps/index.js";
import { usdcAllowanceRecipe } from "./recipes/usdc-allowance/index.js";

export type {
  Recipe,
  RecipeApproval,
  RecipeField,
  RecipeOutput,
  RecipeToken,
} from "./definition.js";
export {
  ensRegistrationRecipe,
  ensRenewalRecipe,
  ensSubnameIssuerRecipe,
  usdcAllowanceRecipe,
  uniswapV3SwapsRecipe,
};

export const recipes = [
  usdcAllowanceRecipe,
  ensRenewalRecipe,
  ensRegistrationRecipe,
  ensSubnameIssuerRecipe,
  uniswapV3SwapsRecipe,
] as const;
export type RegisteredRecipe = (typeof recipes)[number];

export function getRecipe(id: string): RegisteredRecipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}
