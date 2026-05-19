import type { InferPageType } from "fumadocs-core/source";

import { env } from "@/lib/env";
import type { source } from "@/lib/source";

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title} (${page.url})

> For the complete documentation index, see [llms.txt](/llms.txt).

${processed}`;
}

export function getMarkdownUrl(page: InferPageType<typeof source>) {
  return `${page.url}.md`;
}

export function getLLMsIndex(pages: InferPageType<typeof source>[]) {
  const docs = pages
    .map((page) => {
      const url = new URL(getMarkdownUrl(page), env.baseUrl).toString();
      const description = page.data.description
        ? `: ${page.data.description}`
        : "";

      return `- [${page.data.title}](${url})${description}`;
    })
    .join("\n");

  return `# Namera

> Programmable session key layer for smart wallets. Namera lets wallets delegate scoped permissions through session keys with programmable onchain policies.

## Docs

${docs}

## Complete Documentation

- [Full documentation](${new URL("/llms-full.txt", env.baseUrl).toString()}): Complete Namera documentation in one markdown file.
`;
}
