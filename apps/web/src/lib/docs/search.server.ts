import { createFromSource } from "fumadocs-core/search/server";

import { docsSource } from "./source.server";

export const docsSearch = createFromSource(docsSource, {
  buildIndex: async (page) => ({
    id: page.url,
    title: page.data.title,
    ...(page.data.description ? { description: page.data.description } : {}),
    url: page.url,
    structuredData: await page.data.structuredData(),
    ...(page.slugs[0] ? { tag: page.slugs[0] } : {}),
  }),
});
