// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { EnsLabel } from "@namera-ai/protocol";
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Chip, Modal, Typography } from "@namera-ai/ui";
import { useInterval } from "usehooks-ts";
import { formatEther } from "viem";

import { useIdentityPrimary } from "@/hooks/identity";
import { useWalletPasskeyOwner } from "@/hooks/wallet";
import { isOneClawAccount } from "@/lib/session-owner";

import { usePrimaryApproval } from "./use-primary-approval";

export function PrimaryName({
  wallet,
  label,
  canEdit,
}: {
  wallet: WalletResponse;
  label: EnsLabel;
  canEdit: boolean;
}) {
  const query = useIdentityPrimary(wallet.id, label);
  const descriptor = useWalletPasskeyOwner(wallet.id);
  const status = query.data;
  const operation = status?.operation;
  const active =
    operation && ["awaiting-signature", "signed", "submitted"].includes(operation.status);
  const approval = usePrimaryApproval(
    wallet,
    label,
    descriptor.data,
    query.refetch,
    active ? undefined : operation?.operationId,
  );
  useInterval(
    query.refetch,
    active || (operation?.status === "confirmed" && !status?.verified) ? 10_000 : null,
  );
  const resumable =
    operation?.status === "awaiting-signature" &&
    operation.retryKey !== null &&
    operation.name === `${label}.namera.id`;
  const supported =
    isOneClawAccount(wallet) ||
    (wallet.data.validatorType === "webauthn_p256" && Boolean(descriptor.data?.owner));
  const forwardMatches = status?.forwardAddress?.toLowerCase() === wallet.address.toLowerCase();
  return (
    <section className="grid gap-3 rounded-2xl border border-separator p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Heading level={2} className="text-base">
          Ethereum primary name
        </Typography.Heading>
        {status?.verified ? <Chip color="success">Primary name</Chip> : null}
      </div>
      <Typography className="text-sm text-muted">
        Use this name for your account on Ethereum. This requires an onchain transaction paid in ETH
        from this account.
      </Typography>
      {query.isError ? (
        <div className="flex items-center gap-3">
          <Typography className="text-sm text-muted">Couldn’t check ENS resolution.</Typography>
          <Button variant="tertiary" onPress={query.refetch}>
            Retry
          </Button>
        </div>
      ) : !status ? (
        <output className="text-sm text-muted">Checking ENS…</output>
      ) : (
        <>
          {status.primaryName && !status.verified ? (
            <Typography className="break-all text-sm text-muted">
              Current name: {status.primaryName}
            </Typography>
          ) : null}
          {!forwardMatches ? (
            <Typography className="text-sm text-warning">
              Set the Ethereum address record to this account before setting its primary name. ENS
              changes may take time to resolve.
            </Typography>
          ) : null}
          {operation ? (
            <output className="break-words text-sm text-muted">
              {operation.status === "confirmed" && !status.verified
                ? "Transaction confirmed. Waiting for ENS resolution."
                : operation.status === "signed" || operation.status === "submitted"
                  ? `Setting ${operation.name} · awaiting Ethereum confirmation`
                  : operation.status === "awaiting-signature"
                    ? `Approval pending for ${operation.name}`
                    : operation.status === "failed"
                      ? "The transaction failed onchain. You can try again."
                      : null}
            </output>
          ) : null}
          {operation?.transactionHash ? (
            <a
              href={`https://etherscan.io/tx/${operation.transactionHash}`}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-sm text-accent"
            >
              View transaction
            </a>
          ) : null}
          {canEdit && !status.verified ? (
            <Button
              className="w-fit"
              variant="secondary"
              isPending={approval.pending}
              isDisabled={!supported || !forwardMatches || Boolean(active && !resumable)}
              onPress={() => void approval.start(resumable ? operation.retryKey : null)}
            >
              {resumable ? "Resume approval" : "Set primary name"}
            </Button>
          ) : null}
          {canEdit && !supported ? (
            <Typography className="text-sm text-muted">
              Requires a passkey or 1Claw account owner.
            </Typography>
          ) : null}
        </>
      )}
      <Modal
        isOpen={approval.reviewFee !== undefined}
        onOpenChange={(open) => {
          if (!open) approval.answer(false);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="w-full sm:max-w-md">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Set Ethereum primary name</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="grid gap-4">
                  <Typography className="break-all font-medium">{label}.namera.id</Typography>
                  <Typography className="break-all text-sm text-muted">
                    Account: {wallet.address}
                  </Typography>
                  <Typography className="text-sm">
                    Maximum network fee: {formatEther(approval.reviewFee ?? 0n)} ETH
                  </Typography>
                  <Typography className="text-sm text-muted">
                    This replaces the account’s current Ethereum primary name. No tokens are
                    transferred.{" "}
                    {isOneClawAccount(wallet)
                      ? "1Claw will sign after you confirm."
                      : "Your passkey will be requested next."}
                  </Typography>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => approval.answer(false)}>
                  Cancel
                </Button>
                <Button onPress={() => approval.answer(true)}>Confirm and approve</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
