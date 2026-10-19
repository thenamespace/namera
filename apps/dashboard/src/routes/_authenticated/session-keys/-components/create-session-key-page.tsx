import { useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import type { WalletId } from "@namera-ai/protocol";

import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { DashboardPage } from "@/components/page";
import { PermissionDenied } from "@/components/permission-denied";
import { CreateSessionKeyForm } from "@/components/session-key-creation";
import { useWallets } from "@/hooks/wallet";

export function CreateSessionKeyPage({
  canCreate,
  accountId,
  preset,
}: {
  canCreate: boolean;
  accountId?: WalletId | undefined;
  preset?: "get-started" | undefined;
}) {
  const [onboarding] = useState(preset === "get-started");
  const wallets = useWallets();
  const navigate = useNavigate();

  useEffect(() => {
    if (!canCreate || !wallets.data || preset !== "get-started") return;
    // Capture the preset above before replacing the URL, so form edits survive consumption.
    void navigate({
      to: "/session-keys/new",
      search: accountId ? { accountId } : {},
      replace: true,
    });
  }, [accountId, canCreate, navigate, preset, wallets.data]);

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-16">
        {canCreate ? (
          wallets.data ? (
            <CreateSessionKeyForm
              wallets={wallets.data}
              initialAccountId={accountId}
              onboarding={onboarding}
            />
          ) : wallets.isError ? (
            <DataError label="accounts" onRetry={wallets.refetch} isRetrying={wallets.isFetching} />
          ) : (
            <DataLoading className="min-h-64" label="Loading accounts" />
          )
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
