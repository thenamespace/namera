import { Schema } from "effect";

import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { applyMdxPreset, defineCollections, defineConfig } from "fumadocs-mdx/config";

import { BlogFrontmatter } from "./src/lib/blog/schema";

export const blog = defineCollections({
  type: "doc",
  dir: "content/blog",
  // Only root-level articles are public. _drafts never enters either bundle.
  files: ["*.mdx"],
  schema: Schema.toStandardSchemaV1(BlogFrontmatter),
  async: true,
  mdxOptions: applyMdxPreset({
    remarkPlugins: [remarkMdxMermaid],
    remarkStructureOptions: false,
    rehypeCodeOptions: { themes: { light: "github-dark-dimmed", dark: "github-dark-dimmed" } },
  }),
});

export default defineConfig({
  mdxOptions: { rehypeCodeOptions: false, remarkStructureOptions: false },
});
