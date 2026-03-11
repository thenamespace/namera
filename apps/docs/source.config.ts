import {
  rehypeCodeDefaultOptions,
  remarkMdxFiles,
  remarkMdxMermaid,
} from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { transformerTwoslash } from "fumadocs-twoslash";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export const docs = defineDocs({
  dir: "content",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      langs: ["js", "jsx", "ts", "tsx"],
      themes: {
        dark: "github-dark",
        light: "github-light",
      },
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        transformerTwoslash(),
      ],
    },
    rehypePlugins: (v) => [rehypeKatex, ...v],
    remarkPlugins: [remarkMdxMermaid, remarkMdxFiles, remarkMath],
  },
  plugins: [
    lastModified({
      versionControl: "git",
    }),
  ],
});
