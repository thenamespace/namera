import {
  rehypeCodeDefaultOptions,
  remarkMdxFiles,
  remarkMdxMermaid,
} from "fumadocs-core/mdx-plugins";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { transformerTwoslash } from "fumadocs-twoslash";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import z from "zod";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export const blog = defineDocs({
  dir: "content/blog",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageSchema.extend({
      author: z.string(),
      authorUrl: z.string().optional(),
      date: z.iso.date().or(z.date()),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      langs: ["js", "jsx", "ts", "tsx", "json", "bash"],
      themes: {
        dark: "one-dark-pro",
        light: "github-light-default",
      },
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        transformerTwoslash(),
      ],
    },
    rehypePlugins: (v) => [rehypeKatex, ...v],
    remarkNpmOptions: {
      persist: { id: "package-manager" },
    },
    remarkPlugins: [remarkMdxMermaid, remarkMdxFiles, remarkMath],
  },
  plugins: [
    lastModified({
      versionControl: "git",
    }),
  ],
});
