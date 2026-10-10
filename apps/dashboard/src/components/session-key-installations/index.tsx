// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useCallback, useEffect, useRef, useState } from "react";

import { useAtomRefresh } from "@effect/atom-react";

import type {
  GetWalletPasskeyOwnerResponse,
  SessionKeyOperationResponse,
  SessionKeyResponse,
} from "@namera-ai/protocol/dto";
import { Button, Typography } from "@namera-ai/ui";
import { useInterval } from "usehooks-ts";

import { billingAtom } from "@/atoms/billing";
import { ChainDisplay, EvmAddressDisplay } from "@/components/display";
import { PermissionGuard } from "@/components/permission";
import {
  useActiveSessionKeyOperation,
  useSessionKey,
  useSessionKeyOperation,
} from "@/hooks/session-key";
import { useWalletPasskeyOwner } from "@/hooks/wallet";
import { isChainOperationEnabled } from "@/lib/chain-availability";
import { isOneClawAccount } from "@/lib/session-owner";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { ManagedReviewDialog } from "./managed-review-dialog";
import { recoverSponsoredApproval } from "./recovery";
import { useInstallationApproval } from "./use-approval";

const createPermission = ["session-key:create"] as const;
const revokePermission = ["session-key:revoke"] as const;

function ReceiptStatus({
  operationId,
  kind,
  pending,
  onTerminal,
}: {
  operationId: SessionKeyOperationResponse["operationId"];
  kind: "install" | "uninstall";
  pending: boolean;
  onTerminal: () => void;
}) {
  const operation = useSessionKeyOperation(operationId);
  const refreshBilling = useAtomRefresh(billingAtom);
  const handled = useRef(false);
  const status = operation.data?.status;
  const terminal = status === "confirmed" || status === "failed" || status === "expired";
  useInterval(
    () => {
      if (!operation.isFetching) operation.refetch();
    },
    terminal ? null : 3000,
  );
  useEffect(() => {
    if (!terminal || pending || handled.current) return;
    handled.current = true;
    refreshBilling();
    if (status === "confirmed")
      showSuccessToast({
        title: kind === "uninstall" ? "Onchain permissions removed" : "Network approval confirmed",
      });
    else
      showErrorToast(undefined, {
        title:
          kind === "uninstall"
            ? status === "expired"
              ? "Removal approval expired"
              : "Onchain removal failed"
            : status === "expired"
              ? "Approval expired"
              : "Onchain approval failed",
        description: "Review the network and try again.",
      });
    onTerminal();
  }, [terminal, pending, status, kind, refreshBilling, onTerminal]);
  return (
    <output className={operation.isError ? "block text-xs text-muted" : "sr-only"}>
      {operation.isError
        ? "Unable to check receipt. Retrying…"
        : status === "awaiting-signature"
          ? "Awaiting owner approval"
          : "Waiting for onchain confirmation…"}
    </output>
  );
}

function Installation({
  session,
  installation,
  owner,
  refresh,
  working,
  beginApproval,
  endApproval,
}: {
  session: SessionKeyResponse;
  installation: SessionKeyResponse["installations"][number];
  owner: GetWalletPasskeyOwnerResponse | undefined;
  refresh: () => void;
  working: boolean;
  beginApproval: () => boolean;
  endApproval: () => void;
}) {
  const kind = session.status === "revoking" ? "uninstall" : "install";
  const active = useActiveSessionKeyOperation({ installationId: installation.id, kind });
  const approval = useInstallationApproval(session, installation, owner, kind);
  const recovered = active.data?.operation;
  const operationId = approval.operationId ?? recovered?.operationId;
  const retryRequest = recoverSponsoredApproval(
    { installationId: installation.id, kind },
    recovered ?? null,
  );
  const resumable = retryRequest !== undefined;
  const waitingForConfirmation =
    installation.status === "submitted" ||
    (!approval.pending &&
      !approval.error &&
      Boolean(approval.operationId || (recovered && !resumable)));
  const networkAvailable = isChainOperationEnabled(installation.chainId);
  const eligible =
    kind === "uninstall"
      ? installation.status === "installed" || installation.status === "revoking"
      : (session.status === "pending" || session.status === "active") &&
        (installation.status === "pending" || installation.status === "failed");
  const finish = () => {
    refresh();
    active.refetch();
    approval.finish();
  };
  const approve = () => {
    if (!networkAvailable || !active.isSuccess || active.isFetching || (recovered && !resumable))
      return;
    if (beginApproval()) void approval.approve(retryRequest).finally(endApproval);
  };
  return (
    <article className="rounded-lg border border-separator px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <header className="flex min-h-5 items-center [&_.typography]:leading-5">
            <ChainDisplay chainId={installation.chainId} />
          </header>
          <div className="flex min-h-4 flex-wrap items-center gap-x-2 gap-y-1 leading-4">
            <EvmAddressDisplay address={installation.authorization.signerAddress} />
            <Typography.Paragraph
              size="xs"
              color="muted"
              className="rounded-sm bg-default px-1 py-0 text-[10px] leading-4 capitalize"
            >
              {installation.status}
            </Typography.Paragraph>
          </div>
        </div>
        {eligible || waitingForConfirmation ? (
          <PermissionGuard required={kind === "install" ? createPermission : revokePermission}>
            <div className="shrink-0">
              <Button
                variant={kind === "uninstall" ? "danger" : "tertiary"}
                size="sm"
                isPending={approval.pending || waitingForConfirmation}
                isDisabled={
                  !networkAvailable ||
                  waitingForConfirmation ||
                  working ||
                  (!isOneClawAccount(session.wallet) && !owner?.owner) ||
                  !active.isSuccess ||
                  active.isFetching ||
                  Boolean(recovered && !resumable) ||
                  (Boolean(approval.operationId) && !approval.error)
                }
                onPress={approve}
              >
                {approval.pending
                  ? "Approving…"
                  : waitingForConfirmation
                    ? "Waiting…"
                    : approval.error || resumable
                      ? kind === "uninstall"
                        ? "Retry removal"
                        : "Retry approval"
                      : kind === "uninstall"
                        ? isOneClawAccount(session.wallet)
                          ? "Remove with 1Claw"
                          : "Remove with passkey"
                        : "Approve"}
              </Button>
            </div>
          </PermissionGuard>
        ) : null}
      </div>
      {!networkAvailable ? (
        <Typography.Paragraph className="mt-3" size="xs" color="muted">
          Network paused. New approvals are unavailable; already signed operations continue to
          reconcile. API revocation does not remove onchain permissions.
        </Typography.Paragraph>
      ) : null}
      {active.isError ? (
        <div className="mt-2 text-xs text-muted" role="alert">
          Couldn’t check existing approvals.
          <Button variant="tertiary" size="sm" onPress={active.refetch}>
            Retry
          </Button>
        </div>
      ) : null}
      {recovered?.status === "awaiting-signature" && !resumable ? (
        <Typography.Paragraph size="xs" color="muted">
          Resume this approval in the client and user account that started it, or wait for it to
          expire.
        </Typography.Paragraph>
      ) : null}
      {operationId ? (
        <ReceiptStatus
          key={operationId}
          operationId={operationId}
          kind={kind}
          pending={approval.pending}
          onTerminal={finish}
        />
      ) : null}
      {kind === "uninstall" ? (
        <ManagedReviewDialog
          session={session}
          installation={installation}
          isOpen={approval.reviewOpen}
          confirm={approval.confirm}
        />
      ) : null}
    </article>
  );
}

export function SessionKeyInstallations({
  sessionKey,
  compact = false,
}: {
  sessionKey: SessionKeyResponse;
  compact?: boolean;
}) {
  const lock = useRef(false);
  const [working, setWorking] = useState(false);
  const beginApproval = useCallback(() => {
    if (lock.current) return false;
    lock.current = true;
    setWorking(true);
    return true;
  }, []);
  const endApproval = useCallback(() => {
    lock.current = false;
    setWorking(false);
  }, []);
  const query = useSessionKey(sessionKey.id);
  const session = query.data ?? sessionKey;
  const owner = useWalletPasskeyOwner(session.walletId);
  const waiting = session.installations.some(
    ({ status }) => status === "submitted" || status === "revoking",
  );
  useInterval(
    () => {
      if (!query.isFetching) query.refetch();
    },
    waiting ? 5000 : null,
  );
  return (
    <section
      className={`${compact ? "" : "mt-8 "}grid max-w-3xl gap-4`}
      aria-label="Onchain permissions and approvals"
    >
      {!compact ? (
        <Typography.Heading level={3} className="text-base">
          Onchain permissions
        </Typography.Heading>
      ) : null}
      {session.status === "revoking" ? (
        <Typography.Paragraph size="sm" color="muted">
          API access is disabled. Remove this session on every installed network to revoke its
          onchain authority.
        </Typography.Paragraph>
      ) : null}
      {owner.isError && !isOneClawAccount(session.wallet) ? (
        <Typography.Paragraph size="sm" role="alert">
          Couldn’t load the passkey owner.{" "}
          <Button variant="tertiary" size="sm" onPress={owner.refetch}>
            Retry
          </Button>
        </Typography.Paragraph>
      ) : null}
      <div className="grid gap-3">
        {session.installations.map((installation) => (
          <Installation
            key={`${installation.id}:${session.status === "revoking"}`}
            session={session}
            installation={installation}
            owner={owner.data}
            refresh={query.refetch}
            working={working}
            beginApproval={beginApproval}
            endApproval={endApproval}
          />
        ))}
      </div>
    </section>
  );
}
