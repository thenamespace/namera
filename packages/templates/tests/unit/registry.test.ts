import { describe, expect, it } from "vitest";

import { getTemplate, templates, usdcAllowanceTemplate } from "../../src/index.js";

describe("built-in template discovery", () => {
  it("resolves every built-in definition without creating a session", () => {
    expect(templates.map(({ id }) => id)).toEqual([
      "usdc-lifetime-allowance",
      "ens-renewal",
      "ens-registration",
      "ens-subname-issuer",
      "uniswap-v3-swaps",
      "uniswap-v3-liquidity",
    ]);
    for (const template of templates) expect(getTemplate(template.id)).toBe(template);
    expect(getTemplate("usdc-lifetime-allowance")).toBe(usdcAllowanceTemplate);
    expect(getTemplate("custom-application-template")).toBeUndefined();
  });
});
