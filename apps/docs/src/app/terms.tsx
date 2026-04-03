import { Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { useFumadocsLoader } from "fumadocs-core/source/client";

import browserCollections from "fumadocs-mdx:collections/browser";

import type { LegalPageMetadata } from "@/components";
import { LegalPage, legalPageServerLoader } from "@/components";

const clientLoader = browserCollections.miscDocuments.createClientLoader({
  component({ toc, default: MDX }, metadata: LegalPageMetadata) {
    return <LegalPage mdx={MDX} metadata={metadata} toc={toc} />;
  },
});

const TermsPage = () => {
  const data = useFumadocsLoader(Route.useLoaderData());
  return (
    <Suspense>{clientLoader.useContent(data.path, data.metadata)}</Suspense>
  );
};

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  loader: async () => {
    const data = await legalPageServerLoader({ data: { page: "terms" } });
    await clientLoader.preload(data.path);
    return data;
  },
});
