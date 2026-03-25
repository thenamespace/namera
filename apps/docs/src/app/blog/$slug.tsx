import { Suspense } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useFumadocsLoader } from "fumadocs-core/source/client";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";

import browserCollections from "fumadocs-mdx:collections/browser";

import { getMDXComponents } from "@/components";
import { sourceBlog } from "@/lib/source";

export const Route = createFileRoute("/blog/$slug")({
  component: Page,
  head: () => ({
    meta: [
      {
        title: "Blog | Namera",
      },
      { content: "/api/og", property: "og:image" },
    ],
  }),
  loader: async ({ params }) => {
    const slugs = [params.slug];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = sourceBlog.getPage(slugs);

    if (!page) throw notFound();

    return {
      pageTree: await sourceBlog.serializePageTree(sourceBlog.getPageTree()),
      path: page.path,
      url: page.url,
    };
  });

const clientLoader = browserCollections.blog.createClientLoader({
  component({ toc, frontmatter, default: MDX }) {
    return (
      <div>
        <h1>{frontmatter.title}</h1>
        <InlineTOC items={toc} />
        <MDX components={getMDXComponents()} />
      </div>
    );
  },
});

function Page() {
  const data = useFumadocsLoader(Route.useLoaderData());

  return <Suspense>{clientLoader.useContent(data.path)}</Suspense>;
}
