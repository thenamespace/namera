export type ReadingTimeResult = {
  text: string; // Formatted string (e.g., "3 min read")
  minutes: number; // Rounded up minutes
  time: number; // Exact time in milliseconds
  words: number; // Total counted tokens (words + CJK chars)
};

export type BlogMetadata = {
  title: string;
  description?: string;
  author: {
    name: string;
    url?: string;
  };
  datePublished: Date;
  lastModified: Date;
  slug: string;
  readingTime: ReadingTimeResult;
  image?: string;
};

export type DocsMetadata = {
  title: string;
  description?: string;
  lastModified: Date;
  readingTime: ReadingTimeResult;
  slugs: string[];
  url: string;
  keywords?: string;
};

export type BlogCardProps = {
  title: string;
  description?: string;
  author: string;
  datePublished: Date;
  lastModified: Date;
  slug: string;
  image: string;
};
