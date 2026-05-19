import { redirect } from "@tanstack/react-router";
import { createMiddleware, createStart } from "@tanstack/react-start";

import { rewritePath } from "fumadocs-core/negotiation";

const { rewrite: rewriteLLM } = rewritePath(
  "/docs{/*path}.mdx",
  "/llms.mdx/docs{/*path}",
);
const { rewrite: rewriteMarkdown } = rewritePath(
  "/docs{/*path}.md",
  "/llms.mdx/docs{/*path}",
);

const llmMiddleware = createMiddleware().server(({ next, request }) => {
  const url = new URL(request.url);
  const markdownPath = rewriteMarkdown(url.pathname);
  const llmPath = rewriteLLM(url.pathname);
  const path = markdownPath ?? llmPath;

  if (path) {
    throw redirect({ to: new URL(path, url).toString() });
  }

  if (
    url.pathname.startsWith("/docs") &&
    !url.pathname.endsWith(".md") &&
    request.headers.get("accept")?.includes("text/markdown")
  ) {
    throw redirect({ to: new URL(`${url.pathname}.md`, url).toString() });
  }

  return next();
});

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [llmMiddleware],
  };
});
