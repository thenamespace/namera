import { describe, expect, it } from "vitest";

import { getTemplate, templates, usdcAllowanceTemplate } from "../../src/index.js";

describe("built-in template discovery", () => {
  it("resolves the USDC definition without creating a session", () => {
    expect(templates).toEqual([usdcAllowanceTemplate]);
    expect(getTemplate("usdc-lifetime-allowance")).toBe(usdcAllowanceTemplate);
    expect(getTemplate("custom-application-template")).toBeUndefined();
  });
});
