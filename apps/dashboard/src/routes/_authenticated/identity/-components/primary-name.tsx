// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { EnsLabel } from "@namera-ai/protocol";
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Chip, Typography } from "@namera-ai/ui";
import { useInterval } from "usehooks-ts";

import { useIdentityPrimary } from "@/hooks/identity";
import { useWalletPasskeyOwner } from "@/hooks/wallet";
import { isOneClawAccount } from "@/lib/session-owner";

import { PrimaryTransactionReview } from "./primary-transaction-review";
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
  const waiting =
    operation?.status === "signed" ||
    operation?.status === "submitted" ||
    (operation?.status === "confirmed" && !status?.verified);
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
    <div className="grid max-w-xs gap-2 sm:justify-items-end sm:text-right">
      {status?.verified && !query.isError ? (
        <Chip color="success" className="px-2 py-1">
          Primary
        </Chip>
      ) : query.isError ? (
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
          {operation?.status === "failed" ? (
            <output className="break-words text-sm text-muted">
              {operation.transactionHash
                ? "The transaction failed onchain."
                : "The transaction was not submitted."}{" "}
              You can try again.
            </output>
          ) : null}
          {operation?.submissionBlocked && active ? (
            <output className="text-sm text-warning">
              Submission paused. An earlier attempt needs verification before you can retry.
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
              variant="tertiary"
              size="sm"
              aria-live="polite"
              isPending={approval.pending}
              isDisabled={!supported || !forwardMatches || waiting || Boolean(active && !resumable)}
              onPress={() =>
                void approval.start(
                  resumable ? operation.retryKey : null,
                  resumable ? operation.sponsor : true,
                )
              }
            >
              {approval.progress ??
                (operation?.submissionBlocked
                  ? "Submission paused"
                  : waiting
                    ? "Waiting…"
                    : "Set primary name")}
            </Button>
          ) : null}
          {canEdit && !supported ? (
            <Typography className="text-sm text-muted">
              Requires a passkey or 1Claw account owner.
            </Typography>
          ) : null}
        </>
      )}
      {approval.reviewFee !== undefined && approval.reviewContract ? (
        <PrimaryTransactionReview
          wallet={wallet}
          name={`${label}.namera.id`}
          contract={approval.reviewContract}
          fee={approval.reviewFee}
          priceQuote={approval.priceQuote}
          sponsored={approval.sponsored}
          onConfirm={() => approval.answer(true)}
          onCancel={() => approval.answer(false)}
        />
      ) : null}
    </div>
  );
}
