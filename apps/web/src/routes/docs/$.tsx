import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";

import { docs, source } from "#/lib/source";

const nav = { title: "Namera" };
const themeSwitch = { enabled: false };

const serverLoader = createServerFn({ method: "GET" })
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      path: page.path,
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });

export const Route = createFileRoute("/docs/$")({
  loader: ({ params: { _splat: splat } }) =>
    serverLoader({ data: splat?.split("/").filter(Boolean) ?? [] }),
  component: DocsRoute,
});

function DocsRoute() {
  const { path, pageTree } = useFumadocsLoader(Route.useLoaderData());
  const page = docs.getPage(path);
  if (!page) throw notFound();

  const MDX = page.body;

  return (
    <DocsLayout tree={pageTree} nav={nav} themeSwitch={themeSwitch}>
      <DocsPage toc={page.toc}>
        <DocsTitle>{page.title}</DocsTitle>
        <DocsBody>
          <MDX components={defaultMdxComponents} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}
