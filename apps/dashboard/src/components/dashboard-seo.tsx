import { useLayoutEffect } from "react";

import { useMatch, useRouterState } from "@tanstack/react-router";

import type { SessionKeyId, WalletId } from "@namera-ai/protocol";

import { useSessionKey } from "@/hooks/session-key";
import { useWallet } from "@/hooks/wallet";
import { errorSeo, notFoundSeo, pageSeo } from "@/seo/pages";
import { defaultSeo, pageMetadata, resourcePageTitle, type PageSeo } from "@/seo/site";

export function DashboardSeo() {
  const accountMatch = useMatch({ from: "/_authenticated/account/$accountId", shouldThrow: false });
  const sessionMatch = useMatch({
    from: "/_authenticated/session-key/$sessionKeyId",
    shouldThrow: false,
  });
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

  if (page !== errorSeo && page !== notFoundSeo) {
    if (accountMatch?.loaderData)
      return <AccountMetadata accountId={accountMatch.loaderData.accountId} page={page} />;
    if (sessionMatch?.loaderData)
      return <SessionMetadata sessionKeyId={sessionMatch.loaderData.sessionKeyId} page={page} />;
  }
  return <DocumentMetadata page={page} />;
}

function AccountMetadata({ accountId, page }: { accountId: WalletId; page: PageSeo }) {
  const account = useWallet(accountId);
  return <DocumentMetadata page={page} name={account.data?.metadata.name} />;
}

function SessionMetadata({ sessionKeyId, page }: { sessionKeyId: SessionKeyId; page: PageSeo }) {
  const sessionKey = useSessionKey(sessionKeyId);
  return <DocumentMetadata page={page} name={sessionKey.data?.metadata.name} />;
}

function DocumentMetadata({ page, name }: { page: PageSeo; name?: string | undefined }) {
  useLayoutEffect(() => {
    const metadata = pageMetadata(page ?? defaultSeo);
    document.title = resourcePageTitle(metadata.title, name);
    for (const [key, value] of Object.entries(metadata.meta)) {
      document.head
        .querySelector(`meta[data-dashboard-seo="${key}"]`)
        ?.setAttribute("content", value);
    }
  }, [page, name]);

  return null;
}
