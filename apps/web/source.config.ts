import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Schema } from "effect";

import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { applyMdxPreset, defineCollections, defineConfig, defineDocs } from "fumadocs-mdx/config";

import { BlogFrontmatter } from "./src/lib/blog/schema";
import { expandDocSnippets } from "./src/lib/docs/expand-snippets";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    lastModified: async (filePath) => {
      // Source archives and pruned Docker builds have no Git history.
      if (!existsSync(new URL("../../.git", import.meta.url))) return;
      const { stdout } = await execFileAsync("git", ["log", "-1", "--format=%aI", "--", filePath], {
        cwd: repositoryRoot,
      });
      return stdout.trim() ? new Date(stdout.trim()) : undefined;
    },
    postprocess: { includeProcessedMarkdown: true },
    mdxOptions: applyMdxPreset({
      remarkStructureOptions: {},
      rehypeCodeOptions: { themes: { light: "github-dark-dimmed", dark: "github-dark-dimmed" } },
    }),
  },
});

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
  plugins: [{ name: "expand-documentation-snippets", doc: { vfile: expandDocSnippets } }],
  mdxOptions: { rehypeCodeOptions: false, remarkStructureOptions: false },
});
