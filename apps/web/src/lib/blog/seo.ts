import { SITE, jsonLd, seo } from "../seo";
import { BLOG_PAGE_SIZE, blogPath } from "./catalog";
import type { BlogPost } from "./schema";

export const blogFeedLink = {
  rel: "alternate",
  type: "application/rss+xml",
  title: "Namera Blog",
  href: `${SITE.origin}/blog/rss.xml`,
};

export const BLOG_DESCRIPTION =
  "Ideas and guides on AI agent wallets, spending limits, and scoped permissions. Explore product updates and engineering from Namera.";

export const blogIndexHead = (posts: readonly BlogPost[], page = 1) => {
  const path = page === 1 ? "/blog" : `/blog?page=${page}`;
  const url = `${SITE.origin}${path}`;
  const visible = posts.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE);
  const head = seo({
    title: `Namera Blog | Agent Wallets & Permissions${page > 1 ? ` | Page ${page}` : ""}`,
    description: BLOG_DESCRIPTION,
    path,
    noindex: page > 1 && visible.length === 0,
  });
  return {
    ...head,
    links: [...head.links, blogFeedLink],
    scripts: [
      jsonLd({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            "@id": `${url}#webpage`,
            url,
            name: page === 1 ? "Namera Blog" : `Namera Blog - Page ${page}`,
            description: BLOG_DESCRIPTION,
            isPartOf: { "@id": `${SITE.origin}/#website` },
            mainEntity: { "@id": `${url}#articles` },
            inLanguage: "en-US",
          },
          {
            "@type": "Blog",
            "@id": `${SITE.origin}/blog#blog`,
            url: `${SITE.origin}/blog`,
            name: "Namera Blog",
            description: BLOG_DESCRIPTION,
            publisher: { "@id": `${SITE.origin}/#organization` },
          },
          {
            "@type": "ItemList",
            "@id": `${url}#articles`,
            itemListElement: visible.map((post, index) => ({
              "@type": "ListItem",
              position: (page - 1) * BLOG_PAGE_SIZE + index + 1,
              name: post.title,
              url: `${SITE.origin}${blogPath(post.slug)}`,
            })),
          },
        ],
      }),
    ],
  };
};

export const articleHead = (post: BlogPost) => {
  const title = post.seo?.title ?? post.title;
  const description = post.seo?.description ?? post.description;
  const url = post.seo?.canonical ?? `${SITE.origin}${blogPath(post.slug)}`;
  const image = post.cover ??
    post.seo?.image ?? { src: SITE.ogImage, alt: post.title, width: 1200, height: 630 };
  const imageUrl = new URL(image.src, SITE.origin).href;
  const base = seo({
    title,
    description,
    path: blogPath(post.slug),
    type: "article",
    noindex: post.seo?.noindex ?? false,
  });
  const replaced = new Set([
    "og:url",
    "og:image",
    "og:image:alt",
    "og:image:width",
    "og:image:height",
    "og:image:type",
    "twitter:image",
    "twitter:image:alt",
    "keywords",
  ]);
  return {
    meta: [
      ...base.meta.filter(
        (tag) =>
          !("property" in tag && replaced.has(tag.property)) &&
          !("name" in tag && replaced.has(tag.name)),
      ),
      { property: "og:url", content: url },
      { property: "og:image", content: imageUrl },
      { property: "og:image:alt", content: image.alt },
      { property: "og:image:width", content: String(image.width) },
      { property: "og:image:height", content: String(image.height) },
      { name: "twitter:image", content: imageUrl },
      { name: "twitter:image:alt", content: image.alt },
      { name: "keywords", content: (post.seo?.keywords ?? post.tags).join(", ") },
      { property: "article:published_time", content: `${post.date}T00:00:00Z` },
      { property: "article:modified_time", content: `${post.updated ?? post.date}T00:00:00Z` },
      ...post.authors.flatMap((author) => [
        { name: "author", content: author.name },
        ...(author.url ? [{ property: "article:author", content: author.url }] : []),
      ]),
      ...post.tags.map((tag) => ({ property: "article:tag", content: tag })),
    ],
    links: [{ rel: "canonical", href: url }, blogFeedLink],
    scripts: [
      jsonLd({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description,
        url,
        mainEntityOfPage: url,
        isPartOf: { "@id": `${SITE.origin}/blog#blog` },
        timeRequired: `PT${post.readingMinutes}M`,
        image: imageUrl,
        datePublished: `${post.date}T00:00:00Z`,
        dateModified: `${post.updated ?? post.date}T00:00:00Z`,
        author: post.authors.map((author) => ({
          "@type": "Person",
          name: author.name,
          ...(author.url ? { url: author.url } : {}),
        })),
        publisher: {
          "@type": "Organization",
          "@id": `${SITE.origin}/#organization`,
          name: SITE.name,
          url: SITE.origin,
          logo: { "@type": "ImageObject", url: `${SITE.origin}/icon-512.png` },
        },
        keywords: (post.seo?.keywords ?? post.tags).join(", "),
        inLanguage: "en-US",
      }),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE.origin}/blog` },
          { "@type": "ListItem", position: 2, name: post.title, item: url },
        ],
      }),
    ],
  };
};
