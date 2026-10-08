import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("website SEO origin", () => {
  it("uses the configured origin consistently and normalizes trailing slashes", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://namera-landing.vercel.app/");
    const { SITE, seo, ORGANIZATION, WEBSITE } = await import("../../../src/lib/seo.js");
    expect(SITE.origin).toBe("https://namera-landing.vercel.app");
    const head = seo({ path: "/pricing", description: "Pricing" });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE.origin}/pricing`,
    });
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: "https://cdn.namera.ai/seo/og.png",
    });
    expect(head.meta).toContainEqual({
      name: "twitter:image",
      content: "https://cdn.namera.ai/seo/og.png",
    });
    expect(ORGANIZATION.logo).toBe("https://cdn.namera.ai/seo/icon-512.png");
    expect(ORGANIZATION.url).toBe(SITE.origin);
    expect(WEBSITE.url).toBe(SITE.origin);
  });

  it("defaults to the production domain", async () => {
    vi.stubEnv("VITE_SITE_URL", "");
    expect((await import("../../../src/lib/seo.js")).SITE.origin).toBe("https://namera.ai");
  });

  it.each(["invalid", "ftp://example.com", "https://user:password@example.com"])(
    "rejects invalid public site configuration (%#)",
    async (url) => {
      vi.stubEnv("VITE_SITE_URL", url);
      await expect(import("../../../src/lib/seo.js")).rejects.toThrow();
    },
  );
});
