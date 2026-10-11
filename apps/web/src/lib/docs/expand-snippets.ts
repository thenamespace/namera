import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { embedSource } from "fumadocs-core/mdx-plugins/stringifier";

type MarkdownFile = Parameters<typeof embedSource>[0];

/** Expand authored snippets before parsing so HTML, search, and Markdown share source positions. */
export async function expandDocSnippets(file: MarkdownFile): Promise<void> {
  const compiler = file.data["_compiler"] as { addDependency(path: string): void } | undefined;

  async function expand(source: string, path: string, parents: readonly string[]): Promise<string> {
    const matches = [...source.matchAll(/^<include>([^<\n]+\.md)<\/include>\s*$/gm)];
    const replacements = await Promise.all(
      matches.map(async (match) => {
        const target = resolve(dirname(path), match[1] as string);
        if (parents.includes(target)) throw new Error(`Circular documentation snippet: ${target}`);
        compiler?.addDependency(target);
        const content = await expand(await readFile(target, "utf8"), target, [...parents, target]);
        return { match, content };
      }),
    );

    let expanded = source;
    for (const { match, content } of replacements.toReversed()) {
      expanded =
        expanded.slice(0, match.index) + content + expanded.slice(match.index + match[0].length);
    }
    return expanded;
  }

  file.value = await expand(String(file), file.path, [file.path]);
}
