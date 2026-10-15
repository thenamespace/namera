import { createMemoryHistory } from "@tanstack/react-router";

import { onTestFinished, vi } from "vitest";

import { getRouter } from "../../src/router";

// The Effect runtime captures fetch when its HTTP layer is first acquired.
const fetch = vi.fn<typeof globalThis.fetch>();

export function routeFixture(path: string, respond: (url: URL) => Response | Promise<Response>) {
  const requests: URL[] = [];
  fetch.mockReset();
  fetch.mockImplementation(async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    return respond(url);
  });
  vi.stubGlobal("fetch", fetch);

  const router = getRouter();
  router.update({
    context: router.options.context,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  onTestFinished(() => {
    router.options.context.atomRegistry.dispose();
    vi.unstubAllGlobals();
  });

  return { router, requests };
}
