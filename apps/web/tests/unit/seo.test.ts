import { describe, expect, it } from "vitest";

import { jsonLd, seo, SITE } from "../../src/lib/seo";

describe("public page metadata", () => {
  it("escapes script termination without changing structured data", () => {
    const content = { name: '</script><script>alert("example")</script>' };
    const script = jsonLd(content);
    expect(script.children).not.toContain("<");
    expect(JSON.parse(script.children)).toEqual(content);
    expect(script.type).toBe("application/ld+json");
  });

  it("keeps canonical, social URLs and structured data on the configured origin", () => {
    const head = seo({
      title: "Example",
      description: "Example page",
      path: "/docs/sdk",
      image: "/cover.png",
      noindex: true,
    });
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE.origin}/docs/sdk` });
    expect(head.meta).toContainEqual({ property: "og:url", content: `${SITE.origin}/docs/sdk` });
    expect(head.meta).toContainEqual({
      name: "twitter:image",
      content: `${SITE.origin}/cover.png`,
    });
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
    const script = head.scripts[0];
    if (!script) throw new Error("Missing page structured data");
    expect(JSON.parse(script.children)).toMatchObject({
      url: `${SITE.origin}/docs/sdk`,
      primaryImageOfPage: { url: `${SITE.origin}/cover.png` },
    });
  });
});
