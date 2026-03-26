import { Suspense } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useFumadocsLoader } from "fumadocs-core/source/client";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { DocsBody } from "fumadocs-ui/layouts/notebook/page";

import browserCollections from "fumadocs-mdx:collections/browser";

import { getMDXComponents } from "@/components";
import { getReadingTime } from "@/lib/helpers/blog";
import { generateBlogSeo } from "@/lib/seo/blog";
import { sourceBlog } from "@/lib/source";

import type { BlogMetadata } from "../../types/index";
import { BlogHeader } from "./-components";

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = sourceBlog.getPage(slugs);

    if (!page) throw notFound();
    const text = await page.data.getText("processed");
    const readingTime = getReadingTime(text);

    const metadata: BlogMetadata = {
      author: {
        name: page.data.author,
        url: page.data.authorUrl,
      },
      datePublished:
        page.data.date instanceof Date
          ? page.data.date
          : new Date(page.data.date),
      description: page.data.description,
      lastModified: page.data.lastModified ?? new Date(),
      readingTime,
      slug: page.slugs[0] ?? "",
      title: page.data.title,
    };

    return {
      metadata,
      pageTree: await sourceBlog.serializePageTree(sourceBlog.getPageTree()),
      path: page.path,
      url: page.url,
    };
  });

export const Route = createFileRoute("/blog/$slug")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = [params.slug];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => {
    // biome-ignore lint/style/noNonNullAssertion: safe
    const { metadata } = loaderData!;
    return generateBlogSeo(metadata);
  },
});

const clientLoader = browserCollections.blog.createClientLoader({
  component({ toc, frontmatter, default: MDX }, metadata: BlogMetadata) {
    return (
      <DocsBody>
        <article itemScope={true} itemType="https://schema.org/BlogPosting">
          <BlogHeader {...metadata} />
          <div className="max-w-3xl w-full mx-auto px-4 py-12">
            <InlineTOC items={toc} />
            <div itemProp="articleBody">
              <MDX components={getMDXComponents()} />
            </div>
          </div>
        </article>
      </DocsBody>
    );
  },
});

function Page() {
  const data = useFumadocsLoader(Route.useLoaderData());

  return (
    <Suspense>{clientLoader.useContent(data.path, data.metadata)}</Suspense>
  );
}
