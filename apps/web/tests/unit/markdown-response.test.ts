import { describe, expect, it } from "vitest";

import { absoluteMarkdownLinks, markdownResponse } from "../../src/lib/markdown/response";

describe("portable Markdown responses", () => {
  it("resolves relative links, images and fragments against the canonical page", () => {
    const body =
      "[Next](../execute) ![Diagram](/diagram.webp) [Field](#walletId) [External](https://example.com/path) [Email](mailto:hello@example.com)";
    expect(absoluteMarkdownLinks(body, "https://namera.ai/docs/sdk/prepare")).toBe(
      "[Next](https://namera.ai/docs/execute) ![Diagram](https://namera.ai/diagram.webp) [Field](https://namera.ai/docs/sdk/prepare#walletId) [External](https://example.com/path) [Email](mailto:hello@example.com)",
    );
  });

  it("publishes canonical metadata and bounded caching without indexing a duplicate page", async () => {
    const response = markdownResponse("[Next](./execute)", "https://namera.ai/docs/sdk/prepare");
    expect(await response.text()).toBe("[Next](https://namera.ai/docs/sdk/execute)");
    expect(Object.fromEntries(response.headers)).toEqual({
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300, must-revalidate",
      "x-robots-tag": "noindex, follow",
      "x-content-type-options": "nosniff",
      link: '<https://namera.ai/docs/sdk/prepare>; rel="canonical"',
    });
  });

  it("leaves already-portable index content untouched without a canonical page", async () => {
    const body = "# Index\n\n[Docs](https://namera.ai/docs.md)";
    const response = markdownResponse(body);
    expect(await response.text()).toBe(body);
    expect(response.headers.has("Link")).toBe(false);
  });
});
