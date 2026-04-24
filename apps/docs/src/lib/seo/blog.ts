import { env } from "@/lib/env";
import type { BlogMetadata } from "@/types";

import { nameraIcon } from "./common";

export const generateBlogSeo = (metadata: BlogMetadata) => {
  const canonicalUrl = new URL(`/blog/${metadata.slug}`, env.baseUrl);

  const datePublished = metadata.datePublished.toISOString();
  const dateModified = metadata.lastModified.toISOString();

  let imageLink: string;

  if (metadata.image) {
    imageLink = metadata.image;
  } else {
    const ogImage = new URL("/api/og", env.baseUrl);
    ogImage.searchParams.set("description", metadata.description ?? "");
    ogImage.searchParams.set("lastUpdatedDate", dateModified);
    ogImage.searchParams.set("paths", "Blog");
    ogImage.searchParams.set(
      "readTime",
      metadata.readingTime.minutes.toString(),
    );
    ogImage.searchParams.set("title", metadata.title);

    imageLink = ogImage.toString();
  }

  return {
    links: [{ href: canonicalUrl.toString(), rel: "canonical" }],
    meta: [
      { title: metadata.title },
      { content: metadata.description, name: "description" },
      { content: metadata.author.name, name: "author" },
      { content: "index, follow, max-image-preview:large", name: "robots" },
      // Open Graph
      { content: "Namera Blog", property: "og:site_name" },
      { content: "article", property: "og:type" },
      { content: metadata.title, property: "og:title" },
      { content: metadata.description, property: "og:description" },
      { content: canonicalUrl.toString(), property: "og:url" },
      { content: imageLink, property: "og:image" },
      { content: "1200", property: "og:image:width" },
      { content: "630", property: "og:image:height" },
      // Article Tags
      { content: datePublished, property: "article:published_time" },
      { content: dateModified, property: "article:modified_time" },
      { content: metadata.author.url, property: "article:author" },
      // Twitter
      { content: "summary_large_image", name: "twitter:card" },
      { content: "@namera_ai", name: "twitter:site" },
      { content: "@namera_ai", name: "twitter:creator" },
      { content: metadata.title, name: "twitter:title" },
      { content: metadata.description, name: "twitter:description" },
      { content: imageLink, name: "twitter:image" },
      //
    ],
    scripts: [
      {
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          author: {
            "@type": "Person",
            name: metadata.author.name,
            url: metadata.author.url,
          },
          dateModified,
          datePublished,
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
              url: nameraIcon,
            },
            name: "Namera",
          },
          wordCount: metadata.readingTime.words,
        }),
        type: "application/ld+json",
      },
    ],
  };
};

export const generateBaseBlogSeo = () => {
  const canonicalUrl = new URL("/blog", env.baseUrl);

  const title = "Blog | Namera";
  const description =
    "Deep dives on programmable wallet infrastructure, session keys, smart accounts, and safe onchain execution for developers building autonomous agents.";

  const ogImage = new URL("/api/og", env.baseUrl);
  ogImage.searchParams.set("description", description);
  ogImage.searchParams.set("paths", "Blog");
  ogImage.searchParams.set("title", title);

  const imageLink = ogImage.toString();
  return {
    links: [{ href: canonicalUrl.toString(), rel: "canonical" }],
    meta: [
      { title: title },
      { content: description, name: "description" },
      { content: "index, follow", name: "robots" },
      // Open Graph
      { content: "Namera Blog", property: "og:site_name" },
      { content: "article", property: "og:type" },
      { content: title, property: "og:title" },
      { content: description, property: "og:description" },
      { content: canonicalUrl.toString(), property: "og:url" },
      { content: imageLink, property: "og:image" },
      { content: "1200", property: "og:image:width" },
      { content: "630", property: "og:image:height" },
      // Twitter
      { content: "summary_large_image", name: "twitter:card" },
      { content: "@namera_ai", name: "twitter:site" },
      { content: "@namera_ai", name: "twitter:creator" },
      { content: title, name: "twitter:title" },
      { content: description, name: "twitter:description" },
      { content: imageLink, name: "twitter:image" },
      //
    ],
  };
};
