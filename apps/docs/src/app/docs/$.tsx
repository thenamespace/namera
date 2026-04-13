import { Suspense, useEffect } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { cn } from "@namera-ai/ui/lib/utils";
import { usePostHog } from "@posthog/react";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import {
  DocsBody,
  DocsDescription,
  DocsPage as DocsPageCore,
  DocsTitle,
} from "fumadocs-ui/layouts/notebook/page";

import browserCollections from "fumadocs-mdx:collections/browser";

import { getMDXComponents } from "@/components";
import { AISearch, AISearchPanel } from "@/components/ai/search";
import {
  LLMCopyButton,
  ViewOptions,
} from "@/components/mdx-components/page-actions";
import { getReadingTime } from "@/lib/helpers/blog";
import { generateDocsSeo } from "@/lib/seo/docs";
import { baseOptions, githubDetails } from "@/lib/shared";
import { source } from "@/lib/source";
import type { DocsMetadata } from "@/types";

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    const text = await page.data.getText("processed");
    const readingTime = getReadingTime(text);

    const metadata: DocsMetadata = {
      title: page.data.title,
      description: page.data.description,
      lastModified: page.data.lastModified ?? new Date(),
      readingTime,
      slugs: page.slugs,
      url: page.url,
      keywords: page.data.keywords,
    };

    return {
      pageTree: await source.serializePageTree(source.getPageTree()),
      metadata,
      path: page.path,
      url: page.url,
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  component(
    { toc, frontmatter, default: MDX },
    page: {
      url: string;
      path: string;
    },
  ) {
    return (
      <DocsPageCore
        tableOfContent={{
          style: "clerk",
        }}
        toc={toc}
      >
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription className="my-0">
          {frontmatter.description}
        </DocsDescription>
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-4">
          <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
          <ViewOptions
            githubUrl={`https://github.com/${githubDetails.org}/${githubDetails.repo}/blob/main/apps/docs/content/docs/${page.path}`}
            markdownUrl={`${page.url}.mdx`}
          />
        </div>
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPageCore>
    );
  },
});

const DocsPage = () => {
  const data = useFumadocsLoader(Route.useLoaderData());
  const posthog = usePostHog();

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-fire when URL changes
  useEffect(() => {
    posthog.capture("docs_page_viewed", {
      title: data.metadata.title,
      url: data.url,
      slugs: data.metadata.slugs,
    });
  }, [data.url]);

  return (
    <AISearch>
      <DocsLayout
        {...baseOptions()}
        sidebar={{
          tabs: {
            transform(option) {
              return {
                ...option,
                icon: (
                  <div
                    className={cn(
                      "[&_svg]:size-full rounded-lg size-full max-md:border max-md:p-1.5",
                    )}
                  >
                    {option.icon}
                  </div>
                ),
              };
            },
          },
        }}
        tabMode="navbar"
        tree={data.pageTree}
      >
        <AISearchPanel />
        <Suspense>
          {clientLoader.useContent(data.path, {
            path: data.path,
            url: data.url,
          })}
        </Suspense>
      </DocsLayout>
    </AISearch>
  );
};

export const Route = createFileRoute("/docs/$")({
  component: DocsPage,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => {
    // biome-ignore lint/style/noNonNullAssertion: safe
    const { metadata } = loaderData!;
    return generateDocsSeo(metadata);
  },
});
