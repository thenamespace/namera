import type { ReadingTimeResult } from "@/types";

import { env } from "../env";

type LegalPageSeoProps = {
  title: string;
  description?: string;
  keywords: string;
  dateModified: string;
  readingTime: ReadingTimeResult;
};

export const getLegalPageSeo = ({
  title,
  description,
  keywords,
  dateModified,
  readingTime,
}: LegalPageSeoProps) => {
  const ogImage = new URL("/api/og", env.baseUrl);
  ogImage.searchParams.set("type", "docs");
  ogImage.searchParams.set("description", description ?? "");
  ogImage.searchParams.set("lastUpdatedDate", dateModified);
  ogImage.searchParams.set("paths", "Legal");
  ogImage.searchParams.set("readTime", readingTime.minutes.toString());
  ogImage.searchParams.set("title", title);

  const imageLink = ogImage.toString();

  return {
    meta: [
      // Base Tags
      { title },
      { content: description, name: "description" },
      { content: "index, follow", name: "robots" },
      { content: keywords, name: "keywords" },
      // Open Graph
      { content: "website", property: "og:type" },
      { content: title, property: "og:title" },
      { content: description, property: "og:description" },
      { content: "website", property: "og:type" },
      { content: env.baseUrl.toString(), property: "og:url" },
      { content: imageLink, property: "og:image" },
      { content: "Namera", property: "og:site_name" },
      { content: "en_US", property: "og:locale" },
      { content: "Namera Smart Wallets", property: "og:image:alt" },
      // Twitter Tags
      { content: "summary_large_image", name: "twitter:card" },
      { content: title, name: "twitter:title" },
      { content: description, name: "twitter:description" },
      { content: imageLink, name: "twitter:image" },
      { content: "@namera_ai", name: "twitter:creator" },
    ],
  };
};
