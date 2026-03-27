import { env } from "@/lib/env";
import type { DocsMetadata } from "@/types";

const formatSlugToName = (slug: string) => {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const generateDocsSeo = (metadata: DocsMetadata) => {
  const baseUrl = env.baseUrl;
  const canonicalUrl = new URL(`/docs/${metadata.slugs.join("/")}`, baseUrl);
  const dateModified = metadata.lastModified.toISOString();

  const ogImage = new URL("/api/og", baseUrl);
  ogImage.searchParams.set("type", "docs");
  ogImage.searchParams.set("description", metadata.description ?? "");
  ogImage.searchParams.set("lastUpdatedDate", dateModified);
  ogImage.searchParams.set("paths", `Documentation,${metadata.title}`);
  ogImage.searchParams.set("readTime", metadata.readingTime.minutes.toString());
  ogImage.searchParams.set("title", metadata.title);

  const imageLink = ogImage.toString();

  const breadcrumbItems = [
    {
      "@type": "ListItem",
      item: new URL("/docs", baseUrl).toString(),
      name: "Docs",
      position: 1,
    },
  ];
  let currentPath = "/docs";
  metadata.slugs.forEach((slug, index) => {
    currentPath += `/${slug}`;
    const isLastItem = index === metadata.slugs.length - 1;

    breadcrumbItems.push({
      "@type": "ListItem",
      item: new URL(currentPath, baseUrl).toString(),
      // Use the actual title for the final page, otherwise format the slug
      name: isLastItem ? metadata.title : formatSlugToName(slug),
      position: index + 2,
    });
  });

  return {
    links: [{ href: canonicalUrl.toString(), rel: "canonical" }],
    meta: [
      { title: `${metadata.title} | Namera Documentation` },
      { content: metadata.description, name: "description" },
      { content: "index, follow", name: "robots" },
      // Open Graph
      { content: "Namera", property: "og:site_name" },
      { content: "website", property: "og:type" },
      { content: metadata.title, property: "og:title" },
      { content: metadata.description, property: "og:description" },
      { content: canonicalUrl.toString(), property: "og:url" },
      { content: imageLink, property: "og:image" },
      { content: "1200", property: "og:image:width" },
      { content: "630", property: "og:image:height" },
      {
        content: `Documentation for ${metadata.title}`,
        property: "og:image:alt",
      },
      // Twitter
      { content: "summary_large_image", name: "twitter:card" },
      { content: "@namera_ai", name: "twitter:site" },
      { content: "@namera_ai", name: "twitter:creator" },
      { content: metadata.title, name: "twitter:title" },
      { content: metadata.description, name: "twitter:description" },
      { content: imageLink, name: "twitter:image" },
      {
        content: `Documentation for ${metadata.title}`,
        name: "twitter:image:alt",
      },
      //
    ],
    scripts: [
      {
        children: JSON.stringify([
          // Technical Article
          {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            description: metadata.description,
            headline: metadata.title,
            image: imageLink,
            mainEntityOfPage: {
              "@id": canonicalUrl.toString(),
              "@type": "WebPage",
            },
            publisher: {
              "@type": "Organization",
              logo: {
                "@type": "ImageObject",
                height: "60",
                url: new URL("/metadata/icon.png", baseUrl).toString(),
                width: "600",
              },
              name: "Namera",
              url: baseUrl,
            },
          },
          // Breadcrumbs
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumbItems,
          },
        ]),
        type: "application/ld+json",
      },
    ],
  };
};
