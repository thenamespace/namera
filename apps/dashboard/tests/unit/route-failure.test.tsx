import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { RouterError, RouterNotFound } from "../../src/components/route-failure";

describe("route failure presentation", () => {
  it("offers reload and home recovery with an accessible heading", () => {
    const markup = renderToStaticMarkup(<RouterError />);
    expect(markup).toContain("Couldn’t load this page");
    expect(markup).toContain("Reload page");
    expect(markup).toContain("Go to overview");
    expect(markup).toContain('aria-labelledby="route-failure-title"');
  });

  it("distinguishes missing pages from retryable failures", () => {
    const markup = renderToStaticMarkup(<RouterNotFound />);
    expect(markup).toContain("Page not found");
    expect(markup).toContain("Go to overview");
    expect(markup).not.toContain("Reload page");
  });
});
