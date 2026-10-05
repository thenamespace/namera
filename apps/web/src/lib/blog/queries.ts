import { createServerFn } from "@tanstack/react-start";

export const getBlogPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublishedPosts } = await import("./source.server");
  return getPublishedPosts();
});
