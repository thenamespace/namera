import { Schema } from "effect";

const Text = Schema.String.check(Schema.isMinLength(1));
const WebUrl = Schema.String.check(Schema.isPattern(/^https:\/\/[^\s]+$/));
const ImagePath = Schema.String.check(Schema.isPattern(/^(\/[^/]|https:\/\/)[^\s]*$/));
const CdnAssetSlug = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9_-]+(?:[./][a-zA-Z0-9_-]+)*$/),
);
const DateString = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/),
  Schema.makeFilter((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
);

export const BlogFrontmatter = Schema.Struct({
  title: Text,
  description: Text,
  date: DateString,
  updated: Schema.optional(DateString),
  tags: Schema.Array(Text).check(Schema.isMinLength(1)),
  authors: Schema.Array(
    Schema.Struct({
      name: Text,
      url: Schema.optional(WebUrl),
      avatar: Schema.optional(ImagePath),
    }),
  ).check(Schema.isMinLength(1)),
  cover: Schema.optional(CdnAssetSlug),
  seo: Schema.optional(
    Schema.Struct({
      title: Schema.optional(Text),
      description: Schema.optional(Text),
      keywords: Schema.optional(Schema.Array(Text)),
      image: Schema.optional(CdnAssetSlug),
      canonical: Schema.optional(WebUrl),
      noindex: Schema.optional(Schema.Boolean),
    }),
  ),
}).check(Schema.makeFilter((post) => !post.updated || post.updated >= post.date));

export type BlogFrontmatter = typeof BlogFrontmatter.Type;

export type BlogImage = {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
};

export type BlogPost = Omit<BlogFrontmatter, "cover" | "seo"> & {
  readonly cover?: BlogImage | undefined;
  readonly seo?:
    | (Omit<NonNullable<BlogFrontmatter["seo"]>, "image"> & {
        readonly image?: BlogImage | undefined;
      })
    | undefined;
  readonly slug: string;
  readonly path: string;
  readonly readingMinutes: number;
  readonly searchText: string;
};
