import { Layer } from "effect";

import { HttpMiddleware } from "effect/unstable/http";

export const TracingMiddleware = Layer.succeed(
  HttpMiddleware.TracerDisabledWhen,
)((req) => {
  const url = req.url;

  return (
    req.method === "OPTIONS" ||
    req.method === "HEAD" ||
    url.startsWith("/health") ||
    url.startsWith("/rpc") ||
    url.startsWith("/auth/me")
  );
});
