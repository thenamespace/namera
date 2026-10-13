import { expect, it } from "vitest";

import { authPolicy } from "../../../src/auth/data.js";
import { normalizeAuthReturnTo } from "../../../src/auth/return-to.js";

const config = {
  dashboardPublicOrigin: new URL("https://app.example.com"),
  returnTo: authPolicy.returnTo,
};

it.each([
  undefined,
  "/settings/..//attacker.example",
  "/settings/%2e%2e//attacker.example",
  "/settings/..///attacker.example",
  "//attacker.example",
  "https://attacker.example",
  "/\\attacker.example",
  "/settings/ bad",
  "/admin",
  "/settings-other",
])("falls back safely for %s", (input) => {
  expect(normalizeAuthReturnTo(input, config)).toBe("/");
});

it.each([
  ["/", "/"],
  ["/?foo=1#section", "/?foo=1#section"],
  ["/settings/profile?tab=security#keys", "/settings/profile?tab=security#keys"],
  ["/settings/a/../profile", "/settings/profile"],
  ["/identity", "/identity"],
])("preserves approved normalized paths: %s", (input, expected) => {
  const result = normalizeAuthReturnTo(input, config);
  expect(result).toBe(expected);
  expect(new URL(result, config.dashboardPublicOrigin).origin).toBe(
    config.dashboardPublicOrigin.origin,
  );
});
