import { usdcAllowanceTemplate } from "./templates/usdc-allowance/index.js";

export type {
  Template,
  TemplateContext,
  TemplateField,
  TemplateInput,
  TemplateOutput,
} from "./definition.js";
export type { UsdcAllowanceInput } from "./templates/usdc-allowance/input.js";
export { usdcAllowanceTemplate };

export const templates = [usdcAllowanceTemplate] as const;
export type RegisteredTemplate = (typeof templates)[number];

export function getTemplate(id: string): RegisteredTemplate | undefined {
  return templates.find((template) => template.id === id);
}
