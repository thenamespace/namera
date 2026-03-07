import { Suspense } from "react";

import { createFileRoute, notFound, useParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getMDXComponents } from "@repo/ui/components/fumadocs/mdx-components";
import { cn } from "@repo/ui/lib/utils";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";

import browserCollections from "fumadocs-mdx:collections/browser";

import { baseOptions, getSection } from "@/lib/fumadocs/shared";
import { source } from "@/lib/fumadocs/source";

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
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
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      pageTree: await source.serializePageTree(source.getPageTree()),
      path: page.path,
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: MDX }, _props: undefined) {
    return (
      <DocsPage
        tableOfContent={{
          style: "clerk",
        }}
        toc={toc}
      >
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <InlineTOC items={toc}>Table of Contents</InlineTOC>
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    );
  },
});

function Page() {
  const p = useParams({ from: "/docs/$" });
  const section = getSection(p._splat);
  const data = useFumadocsLoader(Route.useLoaderData());

  return (
    <div className={cn(section)}>
      <DocsLayout
        {...baseOptions()}
        sidebar={{
          tabs: {
            transform(option, node) {
              const section =
                (node.$id === "(framework)" ? "framework" : node.$id) ??
                "framework";
              const color = `var(--${section}-color, var(--color-fd-foreground))`;

              return {
                ...option,
                icon: (
                  <div
                    className={cn(
                      "[&_svg]:size-full rounded-lg size-full max-md:border max-md:p-1.5",
                      "text-(--tab-color) max-md:bg-(--tab-color)/10",
                    )}
                    style={
                      {
                        "--tab-color": color,
                      } as React.CSSProperties
                    }
                  >
                    {option.icon}
                  </div>
                ),
              };
            },
          },
        }}
        tree={data.pageTree}
      >
        <Suspense>{clientLoader.useContent(data.path)}</Suspense>
      </DocsLayout>
    </div>
  );
}
