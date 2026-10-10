import { jsonLd, seo, SITE } from "#/lib/seo";

type DocsMetadata = {
  title: string;
  description?: string | undefined;
  url: string;
  lastModified?: string | undefined;
};

const sections: Record<string, string> = {
  sdk: "SDK",
  cli: "CLI",
  mcp: "MCP",
};

export function docsHead(page: DocsMetadata) {
  const section = sections[page.url.split("/")[2] ?? ""];
  const title = `${page.title} | Namera Docs`;
  const url = `${SITE.origin}${page.url}`;
  const image = `/og${page.url}/image.png`;
  const head = seo({
    title,
    description: page.description ?? "Namera documentation",
    path: page.url,
    image,
    imageAlt: title,
  });
  return {
    ...head,
    links: [
      ...head.links,
      { rel: "alternate", type: "text/markdown", title: "Markdown", href: `${url}.md` },
    ],
    scripts: [
      ...head.scripts,
      jsonLd({
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline: page.title,
        description: page.description,
        url,
        image: `${SITE.origin}${image}`,
        mainEntityOfPage: { "@id": `${url}#webpage` },
        author: { "@id": `${SITE.origin}/#organization` },
        publisher: { "@id": `${SITE.origin}/#organization` },
        inLanguage: "en-US",
        ...(page.lastModified ? { dateModified: page.lastModified } : {}),
        ...(section ? { articleSection: section } : {}),
      }),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.origin },
          {
            "@type": "ListItem",
            position: 2,
            name: "Documentation",
            item: `${SITE.origin}/docs/sdk`,
          },
          ...(page.url !== "/docs/sdk"
            ? [
                {
                  "@type": "ListItem",
                  position: 3,
                  name: section ? `${section}: ${page.title}` : page.title,
                  item: url,
                },
              ]
            : []),
        ],
      }),
    ],
  };
}
