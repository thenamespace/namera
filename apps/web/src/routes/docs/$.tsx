import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import {
  BotIcon,
  CommandLineIcon,
  DashboardSquare01Icon,
  BrandGithubIcon,
  Icon,
  NameraIcon,
  PencilEdit02Icon,
  SourceCodeIcon,
} from "@namera-ai/ui/icons";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/spacious";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/spacious/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { AnalyticsPreference } from "#/components/analytics-preference";
import { getDocsSection } from "#/lib/docs/sections";
import { docsHead } from "#/lib/docs/seo";
import { SITE_LINKS } from "#/lib/site-links";

import collections from "../../../.source/browser";
import { DocsHeaderActions } from "./-components/header-actions";
import { DocsSearchDialog } from "./-components/search-dialog";

const getDocsPage = createServerFn({ method: "GET" })
  .validator((slugs: unknown): string[] => {
    if (!Array.isArray(slugs) || !slugs.every((slug): slug is string => typeof slug === "string")) {
      throw new Error("Expected documentation path segments.");
    }
    return slugs;
  })
  .handler(async ({ data: slugs }) => {
    const { docsSource } = await import("#/lib/docs/source.server");
    const page = docsSource.getPage(slugs);
    if (!page) throw notFound();
    const { lastModified } = await page.data.load();
    return {
      path: page.path,
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      lastModified: lastModified?.toISOString(),
      editUrl: `https://github.com/thenamespace/namera/edit/main/apps/web/content/docs/${page.path.split("/").map(encodeURIComponent).join("/")}`,
      tree: await docsSource.serializePageTree(docsSource.pageTree),
    };
  });

const content = collections.docs.createClientLoader({
  component: (
    { default: MDX, toc, frontmatter },
    page: { url: string; editUrl: string; lastModified?: string | undefined },
  ) => (
    <DocsPage toc={toc} footer={{ enabled: false }}>
      <DocsTitle>{frontmatter.title}</DocsTitle>
      <DocsDescription className="mb-2">{frontmatter.description}</DocsDescription>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-6">
        <MarkdownCopyButton className="h-9 px-3 text-sm" markdownUrl={`${page.url}.md`} />
        <ViewOptionsPopover className="h-9 px-3 text-sm" markdownUrl={`${page.url}.md`} />
      </div>
      <DocsBody className="text-fd-foreground/90">
        <MDX components={defaultMdxComponents} />
      </DocsBody>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-fd-muted-foreground">
        <EditOnGitHub href={page.editUrl}>
          <Icon icon={PencilEdit02Icon} aria-hidden className="size-3.5" />
          Edit this page on GitHub
        </EditOnGitHub>
        <AnalyticsPreference />
        {page.lastModified ? (
          <p>
            Last updated{" "}
            <time dateTime={page.lastModified}>
              {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(
                new Date(page.lastModified),
              )}
            </time>
          </p>
        ) : null}
      </div>
    </DocsPage>
  ),
});

export const Route = createFileRoute("/docs/$")({
  beforeLoad: ({ params }) => {
    // TanStack Router names its catch-all route parameter `_splat`.
    // eslint-disable-next-line no-underscore-dangle
    const path = params._splat?.split("/").filter(Boolean).join("/");
    if (path === "dashboard") {
      throw redirect({ to: "/docs/$", params: { _splat: "" }, statusCode: 308 });
    }
  },
  loader: async ({ params }) => {
    // TanStack Router names its catch-all route parameter `_splat`.
    // eslint-disable-next-line no-underscore-dangle
    const page = await getDocsPage({ data: params._splat?.split("/").filter(Boolean) ?? [] });
    await content.preload(page.path);
    return page;
  },
  head: ({ loaderData }) => (loaderData ? docsHead(loaderData) : {}),
  component: DocumentationPage,
});

function DocumentationPage() {
  const page = useFumadocsLoader(Route.useLoaderData());
  const section = getDocsSection(page.url);
  const isDashboard = section === "dashboard";
  return (
    <RootProvider search={{ SearchDialog: DocsSearchDialog }} theme={{ enabled: false }}>
      <div className="namera-docs" data-docs-section={section}>
        <DocsLayout
          slots={{ actions: DocsHeaderActions }}
          tree={
            isDashboard
              ? {
                  ...page.tree,
                  $id: "docs-dashboard",
                  children: page.tree.children.filter(
                    (node) => node.type !== "folder" || !node.root,
                  ),
                }
              : page.tree
          }
          nav={{
            title: (
              <span className="inline-flex items-center gap-2.5">
                <NameraIcon aria-hidden fill="currentColor" className="h-[1cap] w-auto shrink-0" />
                Namera <span className="font-normal text-fd-muted-foreground">Docs</span>
              </span>
            ),
            url: "/docs",
          }}
          themeSwitch={{ enabled: false }}
          tabs={[
            {
              title: "Dashboard",
              description: "Introduction to Namera",
              url: "/docs",
              urls: new Set(["/docs", ...(isDashboard ? [page.url] : [])]),
              icon: (
                <Icon
                  icon={DashboardSquare01Icon}
                  className="docs-section-icon docs-section-icon--dashboard"
                />
              ),
            },
            {
              title: "SDK",
              description: "Wallet APIs for TypeScript",
              url: "/docs/sdk",
              icon: (
                <Icon icon={SourceCodeIcon} className="docs-section-icon docs-section-icon--sdk" />
              ),
            },
            {
              title: "CLI",
              description: "Wallets from your terminal",
              url: "/docs/cli",
              icon: (
                <Icon icon={CommandLineIcon} className="docs-section-icon docs-section-icon--cli" />
              ),
            },
            {
              title: "MCP",
              description: "Wallet tools for AI agents",
              url: "/docs/mcp",
              icon: <Icon icon={BotIcon} className="docs-section-icon docs-section-icon--mcp" />,
            },
          ]}
          links={
            SITE_LINKS.github
              ? [
                  {
                    type: "icon" as const,
                    text: "GitHub",
                    label: "Namera on GitHub",
                    url: SITE_LINKS.github,
                    external: true,
                    icon: <BrandGithubIcon aria-hidden className="size-5" />,
                  },
                ]
              : []
          }
        >
          <main id="main" className="contents">
            {content.useContent(page.path, {
              url: page.url,
              editUrl: page.editUrl,
              lastModified: page.lastModified,
            })}
          </main>
        </DocsLayout>
      </div>
    </RootProvider>
  );
}
