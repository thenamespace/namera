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
import { ChainDisplay } from "@/components/display";
import { PermissionGuard } from "@/components/permission";
import { OnchainAuthorizationSummary } from "@/components/policy/evm/onchain/summary";
import { useSessionKey, useSessionKeyOperation } from "@/hooks/session-key";
import { useWalletPasskeyOwner } from "@/hooks/wallet";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { useInstallationApproval } from "./use-approval";

const createPermission = ["session-key:create"] as const;
const revokePermission = ["session-key:revoke"] as const;

function ReceiptStatus({
  operationId,
  pending,
  onTerminal,
}: {
  operationId: SessionKeyOperationResponse["operationId"];
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
    if (status === "confirmed") showSuccessToast({ title: "Network approval confirmed" });
    else
      showErrorToast(undefined, {
        title: status === "expired" ? "Approval expired" : "Onchain approval failed",
        description: "Review the network and try again.",
      });
    onTerminal();
  }, [terminal, pending, status, refreshBilling, onTerminal]);
  return (
    <output className="block text-xs text-muted">
      {operation.isError
        ? "Unable to check receipt. Retrying…"
        : status === "awaiting-signature"
          ? "Awaiting passkey approval"
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
  const approval = useInstallationApproval(session, installation, owner, kind);
  const eligible =
    kind === "uninstall"
      ? installation.status === "installed" || installation.status === "revoking"
      : (session.status === "pending" || session.status === "active") &&
        (installation.status === "pending" || installation.status === "failed");
  const finish = () => {
    refresh();
    approval.finish();
  };
  const approve = () => {
    if (beginApproval()) void approval.approve().finally(endApproval);
  };
  return (
    <article className="rounded-xl bg-surface p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <ChainDisplay chainId={installation.chainId} />
        <Typography.Paragraph size="xs" color="muted">
          {installation.status}
        </Typography.Paragraph>
      </header>
      <OnchainAuthorizationSummary authorization={installation.authorization} />
      {eligible ? (
        <PermissionGuard required={kind === "install" ? createPermission : revokePermission}>
          <div className="mt-4 grid gap-2">
            <Button
              variant={kind === "uninstall" ? "danger" : "tertiary"}
              size="sm"
              isPending={approval.pending}
              isDisabled={
                working || !owner?.owner || (Boolean(approval.operationId) && !approval.error)
              }
              onPress={approve}
            >
              {approval.pending
                ? "Checking approval…"
                : approval.error
                  ? "Retry approval"
                  : kind === "uninstall"
                    ? "Remove with passkey"
                    : "Approve with passkey"}
            </Button>
            <Typography.Paragraph size="xs" color="muted">
              Gas sponsored by Namera. This operation counts toward your plan’s usage.
            </Typography.Paragraph>
          </div>
        </PermissionGuard>
      ) : null}
      {approval.operationId ? (
        <ReceiptStatus
          key={approval.operationId}
          operationId={approval.operationId}
          pending={approval.pending}
          onTerminal={finish}
        />
      ) : null}
    </article>
  );
}

export function SessionKeyInstallations({ sessionKey }: { sessionKey: SessionKeyResponse }) {
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
    <section className="mt-8 grid max-w-3xl gap-4" aria-label="Onchain permissions and approvals">
      <Typography.Heading level={3} className="text-base">
        Onchain permissions
      </Typography.Heading>
      <Typography.Paragraph size="sm" color="muted">
        {session.status === "revoking"
          ? "API access is disabled. Remove this session on every installed network to revoke its onchain authority."
          : "Approve each network with the account owner’s passkey. API policies apply only to requests sent through Namera."}
      </Typography.Paragraph>
      {owner.isError ? (
        <Typography.Paragraph size="sm" role="alert">
          Couldn’t load the passkey owner.{" "}
          <Button variant="tertiary" size="sm" onPress={owner.refetch}>
            Retry
          </Button>
        </Typography.Paragraph>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
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
