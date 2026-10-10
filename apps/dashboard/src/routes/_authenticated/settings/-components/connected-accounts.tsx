import { useCallback, useState } from "react";

import { DateTime } from "effect";

import type { AccountId } from "@namera-ai/protocol";
import { AlertDialog, Button, Chip, ItemCard, Typography } from "@namera-ai/ui";
import { BrandGoogleIcon } from "@namera-ai/ui/icons";

import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { HeadingGroup } from "@/components/heading-group";
import {
  useConnectGoogle,
  useConnectedAccounts,
  useGoogleConfiguration,
  useUnlinkConnectedAccount,
} from "@/hooks/auth/google";
import { useLogout } from "@/hooks/auth/session";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

export function ConnectedAccounts({
  signedInAt,
  outcome,
}: {
  signedInAt: DateTime.Utc;
  outcome?: string | undefined;
}) {
  const configuration = useGoogleConfiguration();
  const accounts = useConnectedAccounts();
  const [disconnectId, setDisconnectId] = useState<AccountId | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(outcome === "REAUTHENTICATION_REQUIRED");
  const onError = (error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      Reflect.get(error, "code") === "REAUTHENTICATION_REQUIRED"
    )
      setNeedsSignIn(true);
    showErrorToast(error, { title: "Couldn’t update Google connection" });
  };
  const connect = useConnectGoogle({
    onError,
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
  });
  const disconnect = useUnlinkConnectedAccount({
    onError,
    onSuccess: () => {
      setDisconnectId(null);
      showSuccessToast({
        title: "Google disconnected",
        description: "You can still sign in with email.",
      });
    },
  });
  const logout = useLogout({
    onError,
    onSuccess: () => window.location.replace("/auth?returnTo=%2Fsettings%2Fsecurity"),
  });
  const requestConnect = useCallback(() => {
    if (Date.now() - DateTime.toEpochMillis(signedInAt) > 10 * 60 * 1000) setNeedsSignIn(true);
    else connect.mutate();
  }, [signedInAt, connect]);
  const requestDisconnect = useCallback(() => {
    const account = accounts.data?.[0];
    if (!account) return;
    if (Date.now() - DateTime.toEpochMillis(signedInAt) > 10 * 60 * 1000) setNeedsSignIn(true);
    else setDisconnectId(account.id);
  }, [signedInAt, accounts.data]);
  const requestSignIn = useCallback(() => logout.mutate(), [logout]);
  const cancelDisconnect = useCallback(() => setDisconnectId(null), []);
  const confirmDisconnect = useCallback(() => {
    if (disconnectId) disconnect.mutate({ params: { accountId: disconnectId } });
  }, [disconnectId, disconnect]);
  const onDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !disconnect.isPending) setDisconnectId(null);
    },
    [disconnect.isPending],
  );

  return (
    <section aria-labelledby="connected-accounts-heading" className="mb-10">
      <HeadingGroup className="mb-4">
        <HeadingGroup.Title id="connected-accounts-heading">Connected accounts</HeadingGroup.Title>
      </HeadingGroup>
      {outcome === "linked" && accounts.data?.length ? (
        <Typography.Paragraph aria-live="polite" className="mb-4" size="sm">
          Google connected. You can now use it to sign in.
        </Typography.Paragraph>
      ) : null}
      {accounts.isError ? (
        <DataError
          compact
          label="your connected accounts"
          onRetry={accounts.refetch}
          isRetrying={accounts.isFetching}
        />
      ) : accounts.isLoading && !accounts.data ? (
        <DataLoading label="Loading connected accounts" />
      ) : (
        <ItemCard
          variant="default"
          className="group min-h-16 rounded-lg border flex-wrap sm:flex-nowrap"
        >
          <ItemCard.Icon>
            <BrandGoogleIcon aria-hidden="true" className="size-5" />
          </ItemCard.Icon>
          <ItemCard.Content className="min-w-0">
            <ItemCard.Title className="flex items-center gap-2">
              Google
              {accounts.data?.length ? (
                <Chip color="success" size="sm" variant="soft">
                  Connected
                </Chip>
              ) : null}
            </ItemCard.Title>
            <ItemCard.Description className="whitespace-normal break-all">
              {accounts.data?.[0]?.email ?? (accounts.data?.length ? "Connected" : "Not connected")}
            </ItemCard.Description>
          </ItemCard.Content>
          <ItemCard.Action>
            {accounts.data?.[0] ? (
              <Button
                className="opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
                variant="danger-soft"
                size="sm"
                onPress={requestDisconnect}
              >
                Disconnect
              </Button>
            ) : configuration.data?.enabled ? (
              <Button
                variant="secondary"
                size="sm"
                isPending={connect.isPending}
                onPress={requestConnect}
              >
                Connect Google
              </Button>
            ) : (
              <Typography.Paragraph size="sm" color="muted">
                Google sign-in is currently unavailable.
              </Typography.Paragraph>
            )}
          </ItemCard.Action>
        </ItemCard>
      )}
      {needsSignIn ? (
        <div className="mt-4 flex flex-col items-start gap-3" aria-live="polite">
          <Typography.Paragraph size="sm">
            Sign in again to change your connected accounts. This protects your account if a browser
            session is left open.
          </Typography.Paragraph>
          <Button variant="secondary" isPending={logout.isPending} onPress={requestSignIn}>
            Sign in again
          </Button>
        </div>
      ) : null}
      <AlertDialog.Backdrop isOpen={disconnectId !== null} onOpenChange={onDialogOpenChange}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog className="rounded-xl">
            <AlertDialog.Header>
              <AlertDialog.Heading>Disconnect Google?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              Google sign-in will be disabled. Email sign-in and existing sessions stay active.
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                size="sm"
                variant="tertiary"
                isDisabled={disconnect.isPending}
                onPress={cancelDisconnect}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                isPending={disconnect.isPending}
                onPress={confirmDisconnect}
              >
                Disconnect Google
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </section>
  );
}
