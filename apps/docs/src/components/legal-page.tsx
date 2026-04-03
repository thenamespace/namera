import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import type { TOCItemType } from "fumadocs-core/toc";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { DocsBody } from "fumadocs-ui/layouts/notebook/page";
import type { MDXProps } from "mdx/types";

import { getReadingTime } from "@/lib/helpers/blog";
import { sourceMisc } from "@/lib/source";
import type { ReadingTimeResult } from "@/types";

import { Footer } from "./footer";
import { getMDXComponents } from "./mdx-components";
import { Navbar } from "./navbar";

export type LegalPageMetadata = {
  description: string | undefined;
  lastModified: Date;
  readingTime: ReadingTimeResult;
  slug: string;
  title: string;
};

type LegalPageProps = {
  toc: TOCItemType[];
  mdx: React.FC<MDXProps>;
  metadata: LegalPageMetadata;
};

export const legalPageServerLoader = createServerFn({
  method: "GET",
})
  .inputValidator((data: { page: "terms" | "privacy-policy" }) => data)
  .handler(async ({ data }) => {
    const page = sourceMisc.getPage([data.page]);

    if (!page) throw notFound();
    const text = await page.data.getText("processed");
    const readingTime = getReadingTime(text);

    const metadata = {
      description: page.data.description,
      lastModified: page.data.lastModified ?? new Date(),
      readingTime,
      slug: page.slugs[0] ?? "",
      title: page.data.title,
    };

    return {
      metadata,
      pageTree: await sourceMisc.serializePageTree(sourceMisc.getPageTree()),
      path: page.path,
      url: page.url,
    };
  });

export const LegalPage = ({ toc, mdx: MDX, metadata }: LegalPageProps) => {
  return (
    <div className="px-4">
      <Navbar />
      <div className="flex flex-col gap-2 h-[20dvh] items-center justify-center max-w-5xl border-b mx-auto my-8 relative">
        <img
          alt="Crescent Background"
          className="absolute top-0 left-0 pointer-events-none w-full transform-[rotate(180deg)]"
          src="/assets/crescent-bottom.png"
        />
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-8">
          <h1 className="text-3xl md:text-5xl font-helveticaDisplay heading-gradient pb-2">
            {metadata.title}
          </h1>
          <p className="font-base text-muted-foreground">
            Last updated:{" "}
            {metadata.lastModified.toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
      <DocsBody>
        <div className="max-w-3xl w-full mx-auto">
          <InlineTOC items={toc} />
          <div className="px-1">
            <MDX components={getMDXComponents()} />
          </div>
        </div>
      </DocsBody>
      <Footer />
    </div>
  );
};
