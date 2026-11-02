import { ensRegistrationTemplate } from "./templates/ens-registration/index.js";
import { ensRenewalTemplate } from "./templates/ens-renewal/index.js";
import { ensSubnameIssuerTemplate } from "./templates/ens-subname-issuer/index.js";
import { uniswapV3LiquidityTemplate } from "./templates/uniswap-v3-liquidity/index.js";
import { uniswapV3SwapsTemplate } from "./templates/uniswap-v3-swaps/index.js";
import { usdcAllowanceTemplate } from "./templates/usdc-allowance/index.js";

export type {
  Template,
  TemplateField,
  TemplateOutput,
  TemplateToken,
  TemplateContext,
  TemplateInput,
} from "./definition.js";
export type { UsdcAllowanceInput } from "./templates/usdc-allowance/input.js";
export {
  ensRegistrationTemplate,
  ensRenewalTemplate,
  ensSubnameIssuerTemplate,
  usdcAllowanceTemplate,
  uniswapV3SwapsTemplate,
  uniswapV3LiquidityTemplate,
};

export const templates = [
  usdcAllowanceTemplate,
  ensRenewalTemplate,
  ensRegistrationTemplate,
  ensSubnameIssuerTemplate,
  uniswapV3SwapsTemplate,
  uniswapV3LiquidityTemplate,
] as const;
export type RegisteredTemplate = (typeof templates)[number];

export function getTemplate(id: string): RegisteredTemplate | undefined {
  return templates.find((template) => template.id === id);
}
