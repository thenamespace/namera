import { afterEach, expect, it, vi } from "vitest";

import { filterPosts } from "../../src/lib/blog/catalog";
import { renderBlogRss } from "../../src/lib/blog/rss";
import { getPublishedPosts } from "../../src/lib/blog/source.server";
import { startInstance } from "../../src/start";

afterEach(() => vi.useRealTimers());

async function requestContent(
  path: string,
  {
    method = "GET",
    accept = "text/html",
    handlerType = "router",
    vary,
  }: { method?: string; accept?: string; handlerType?: "router" | "serverFn"; vary?: string } = {},
) {
  const request = new Request(`https://namera.ai${path}`, { method, headers: { Accept: accept } });
  const response = new Response("HTML page", { headers: vary ? { Vary: vary } : {} });
  const nextCalled = vi.fn();
  const next = <T>(options?: { context?: T }) => {
    nextCalled();
    return { request, pathname: path, context: options?.context, response };
  };
  const options = await startInstance.getOptions();
  const middleware = options.requestMiddleware?.[0]?.options.server;
  if (!middleware) throw new Error("Documentation middleware missing");
  // This middleware calls next without extending TanStack's generic context.
  const result = await middleware({
    request,
    pathname: path,
    context: undefined,
    handlerType,
    next: next as Parameters<typeof middleware>[0]["next"],
  });
  return { response: result instanceof Response ? result : result.response, next: nextCalled };
}

it.each(["/pricing.md", "/terms.md", "/privacy-policy.md"])(
  "serves %s with canonical Markdown headers and no body for HEAD",
  async (path) => {
    const get = await requestContent(path);
    expect(get.response.status).toBe(200);
    expect(get.response.headers.get("Content-Type")).toContain("text/markdown");
    expect(get.response.headers.get("Vary")).toBe("Accept");
    expect(await get.response.text()).not.toBe("");
    expect(get.next).not.toHaveBeenCalled();
    const head = await requestContent(path, { method: "HEAD" });
    expect(await head.response.text()).toBe("");
    expect(head.response.headers.get("Content-Type")).toBe(
      get.response.headers.get("Content-Type"),
    );
  },
);

it("negotiates Markdown by Accept and preserves existing HTML Vary", async () => {
  const markdown = await requestContent("/pricing", { accept: "text/markdown" });
  expect(markdown.response.headers.get("Content-Type")).toContain("text/markdown");
  const html = await requestContent("/pricing", { vary: "Accept-Encoding" });
  expect(html.response.headers.get("Vary")).toBe("Accept-Encoding, Accept");
  expect(html.response.headers.get("Cache-Control")).toBe("no-cache");
  expect(await html.response.text()).toBe("HTML page");
});

it.each(["Accept", "*", "accept"])("does not duplicate existing Vary %s", async (vary) => {
  const { response } = await requestContent("/docs", { vary });
  expect(response.headers.get("Vary")).toBe(vary);
});

it.each(["/docs/dashboard?source=old", "/docs/dashboard.md?source=old"])(
  "redirects legacy %s while retaining the query",
  async (path) => {
    const { response, next } = await requestContent(path);
    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe(path.replace("/dashboard", ""));
    expect(next).not.toHaveBeenCalled();
  },
);

it.each([{ method: "POST" }, { handlerType: "serverFn" as const }])(
  "passes non-document requests through unchanged: %j",
  async (options) => {
    const { response, next } = await requestContent("/pricing.md", options);
    expect(next).toHaveBeenCalledOnce();
    expect(await response.text()).toBe("HTML page");
    expect(response.headers.has("Vary")).toBe(false);
  },
);

it.each(["/docs/not-a-real-page.md", "/blog/not-a-real-post.md"])(
  "returns no-store404 for unknown content %s",
  async (path) => {
    const { response, next } = await requestContent(path);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(next).not.toHaveBeenCalled();
  },
);

it("serves the generated documentation index without unresolved includes", async () => {
  const { response } = await requestContent("/llms.txt");
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  const body = await response.text();
  expect(body).toContain("/docs/");
  expect(body).not.toContain("<include");
});

it("serves compiled SDK documentation with expanded snippets", async () => {
  const { response } = await requestContent("/docs/sdk.md");
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toContain("text/markdown");
  const body = await response.text();
  expect(body).toContain("NameraClient");
  expect(body).toContain("https://namera.ai/docs/sdk");
  expect(body).not.toContain("<include");
});

it("publishes compiled blog content only once its publication day arrives", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const slug = "agents-need-permissions-not-private-keys";
  vi.setSystemTime(new Date("2026-04-13T23:59:59Z"));

  const unpublished = await getPublishedPosts();
  expect(unpublished.some((post) => post.slug === slug)).toBe(false);
  expect(filterPosts(unpublished, "agents")).toEqual([]);
  expect(renderBlogRss(unpublished)).not.toContain(slug);
  expect(await (await requestContent("/llms.txt")).response.text()).not.toContain(slug);
  expect((await requestContent(`/blog/${slug}.md`)).response.status).toBe(404);

  vi.setSystemTime(new Date("2026-04-14T00:00:00Z"));
  const published = await getPublishedPosts();
  expect(filterPosts(published, "agents").map((post) => post.slug)).toContain(slug);
  expect(published.every((post) => !post.path.includes("_drafts"))).toBe(true);
  expect(renderBlogRss(published)).toContain(slug);
  expect(await (await requestContent("/llms.txt")).response.text()).toContain(slug);
  const article = await requestContent(`/blog/${slug}.md`);
  expect(article.response.status).toBe(200);
  expect(await article.response.text()).toContain("Published 2026-04-14");
  expect(await (await requestContent(`/blog/${slug}.md`, { method: "HEAD" })).response.text()).toBe(
    "",
  );
});
