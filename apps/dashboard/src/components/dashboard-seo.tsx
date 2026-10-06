import { useLayoutEffect } from "react";

import { useRouterState } from "@tanstack/react-router";

import { errorSeo, notFoundSeo, pageSeo } from "@/seo/pages";
import { defaultSeo, pageMetadata } from "@/seo/site";

export function DashboardSeo() {
  const page = useRouterState({
    select: (state) => {
      if (state.matches.some((match) => match.status === "error")) return errorSeo;
      // TanStack marks unmatched child paths on the parent match with `_notFound`.
      // eslint-disable-next-line no-underscore-dangle
      if (state.matches.some((match) => match.status === "notFound" || match._notFound))
        return notFoundSeo;
      const match = state.matches.at(-1);
      const metadata = match ? pageSeo[match.routeId as keyof typeof pageSeo] : defaultSeo;
      // Auth query strings can carry invite codes or return paths. They are not
      // separate public entry pages, even though their canonical stays clean.
      return state.location.searchStr ? { ...metadata, indexable: false } : metadata;
    },
  });

  useLayoutEffect(() => {
    const metadata = pageMetadata(page ?? defaultSeo);
    document.title = metadata.title;
    for (const [key, value] of Object.entries(metadata.meta)) {
      document.head
        .querySelector(`meta[data-dashboard-seo="${key}"]`)
        ?.setAttribute("content", value);
    }
  }, [page]);

  return null;
}
