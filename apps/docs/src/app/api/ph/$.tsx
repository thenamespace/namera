import { createFileRoute } from "@tanstack/react-router";

import { env } from "@/lib/env";

const POSTHOG_API_HOST_PREFIX = "/api/ph";

const handleProxy = async (request: Request) => {
  const url = new URL(request.url);

  const posthogUrl = url.pathname.startsWith(
    `${POSTHOG_API_HOST_PREFIX}/static/`,
  )
    ? new URL(env.postHogAssetsHost)
    : new URL(env.postHogHost);

  const newUrl = new URL(url);
  newUrl.protocol = posthogUrl.protocol;
  newUrl.hostname = posthogUrl.hostname;
  newUrl.port = posthogUrl.port;
  newUrl.pathname = newUrl.pathname.replace(POSTHOG_API_HOST_PREFIX, "");

  const headers = new Headers(request.headers);
  headers.set("host", posthogUrl.hostname);

  const originalHost = request.headers.get("host");
  if (originalHost) {
    headers.set("X-Forwarded-Host", originalHost);
  }

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For");
  if (ip) {
    headers.set("X-Forwarded-For", ip);
  }

  headers.delete("cookie");
  headers.delete("connection"); // https://datatracker.ietf.org/doc/html/rfc7230#section-6.1

  const response = await fetch(newUrl, {
    method: request.method,
    headers,
    ...(!["HEAD", "GET"].includes(request.method)
      ? {
          body: request.body,
          duplex: "half",
        }
      : {}),
  });

  const body = await response.text();

  // See https://github.com/nodejs/undici/issues/2514
  const responseHeaders = new Headers(response.headers);
  if (responseHeaders.has("content-encoding")) {
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
  }

  const isBodylessStatus = [204, 205, 304].includes(response.status);

  return new Response(isBodylessStatus ? null : body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

export const Route = createFileRoute("/api/ph/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handleProxy(request),
      POST: ({ request }) => handleProxy(request),
      PUT: ({ request }) => handleProxy(request),
      PATCH: ({ request }) => handleProxy(request),
      DELETE: ({ request }) => handleProxy(request),
      OPTIONS: ({ request }) => handleProxy(request),
      HEAD: ({ request }) => handleProxy(request),
    },
  },
});
