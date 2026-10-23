import { expect, it } from "vitest";

import { pricingMarkdown } from "../../src/lib/pricing/markdown.server";

it("publishes open beta access and the dashboard signup link in pricing Markdown", () => {
  const markdown = pricingMarkdown("https://namera.ai");

  expect(markdown).toContain("## Open beta");
  expect(markdown).toContain("[Get started](https://dashboard.namera.ai)");
  expect(markdown).toContain("No invite required.");
  expect(markdown).toContain("Paid plans: Coming soon.");
  expect(markdown).not.toMatch(/waitlist|Launching soon/);
});
