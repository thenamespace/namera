import { describe, expect, it, vi } from "vitest";

import { startInstance } from "../../src/start";

const requestCases: ReadonlyArray<{
  readonly name: string;
  readonly headers: HeadersInit;
  readonly status: number;
}> = [
  { name: "same-origin fetch", headers: { "Sec-Fetch-Site": "same-origin" }, status: 200 },
  { name: "same-origin Origin", headers: { Origin: "https://namera.ai" }, status: 200 },
  { name: "same-origin Referer", headers: { Referer: "https://namera.ai/blog" }, status: 200 },
  {
    name: "cross-site fetch with a matching Origin",
    headers: { "Sec-Fetch-Site": "cross-site", Origin: "https://namera.ai" },
    status: 403,
  },
  { name: "cross-origin Origin", headers: { Origin: "https://example.com" }, status: 403 },
  { name: "cross-origin Referer", headers: { Referer: "https://example.com" }, status: 403 },
  { name: "missing origin metadata", headers: {}, status: 403 },
];

describe.each(["GET", "POST"])("%s server function CSRF protection", (method) => {
  it.each(requestCases)("$name returns $status", async ({ headers, status }) => {
    const options = await startInstance.getOptions();
    const middleware = options.requestMiddleware?.[0]?.options.server;
    if (!middleware) throw new Error("CSRF middleware missing");

    const request = new Request("https://namera.ai/_serverFn/example", { method, headers });
    const next = vi.fn(async () => ({
      request,
      pathname: "/_serverFn/example",
      context: undefined,
      response: new Response("RPC response"),
    }));

    const result = await middleware({
      request,
      pathname: "/_serverFn/example",
      context: undefined,
      handlerType: "serverFn",
      next: next as Parameters<typeof middleware>[0]["next"],
    });
    const response = result instanceof Response ? result : result.response;

    expect(response.status).toBe(status);
    expect(next).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  });
});

it("allows cross-site navigation to public routes", async () => {
  const options = await startInstance.getOptions();
  const middleware = options.requestMiddleware?.[0]?.options.server;
  if (!middleware) throw new Error("CSRF middleware missing");

  const request = new Request("https://namera.ai/blog", {
    headers: { "Sec-Fetch-Site": "cross-site" },
  });
  const next = vi.fn(async () => ({
    request,
    pathname: "/blog",
    context: undefined,
    response: new Response("Blog page"),
  }));
  const result = await middleware({
    request,
    pathname: "/blog",
    context: undefined,
    handlerType: "router",
    next: next as Parameters<typeof middleware>[0]["next"],
  });
  const response = result instanceof Response ? result : result.response;

  expect(response.status).toBe(200);
  expect(await response.text()).toBe("Blog page");
  expect(next).toHaveBeenCalledOnce();
});
