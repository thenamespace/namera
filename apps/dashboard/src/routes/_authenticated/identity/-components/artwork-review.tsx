// oxlint-disable react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-jsx-as-prop
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button } from "@namera-ai/ui";

import {
  ChainDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  WalletOwnerDisplay,
} from "@/components/display";
import { TransactionOverview } from "@/components/transaction-overview";

import type { ArtworkDraft } from "./artwork-schema";
import type { ArtworkProgress } from "./artwork-upload";

export function ArtworkReview({
  wallet,
  name,
  draft,
  progress,
  ready,
  approvalError,
  onRetryApproval,
  onConfirm,
  onCancel,
}: {
  wallet: WalletResponse;
  name: string;
  draft: ArtworkDraft;
  progress: ArtworkProgress | null;
  ready: boolean;
  approvalError: boolean;
  onRetryApproval: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <TransactionOverview
      isOpen
      title="Review avtr.cc upload"
      description={`Upload your images to avtr.cc and update the public profile for ${name}.`}
      confirmText={progress ?? (!ready && !approvalError ? "Loading…" : "Confirm and save")}
      isPending={progress !== null}
      isConfirmDisabled={!ready}
      onConfirm={onConfirm}
      onCancel={onCancel}
      rows={[
        {
          id: "namespace",
          key: "Namespace",
          value: <NamespaceDisplay namespace={wallet.namespace} />,
        },
        {
          id: "account",
          key: "Account",
          value: <MetadataDisplay metadata={wallet.metadata} fallbackName="Account" />,
        },
        {
          id: "custody",
          key: "Custody",
          value: (
            <WalletOwnerDisplay
              custody={wallet.owner.custody}
              provider={
                wallet.owner.custody === "namera-managed" ? wallet.owner.provider : undefined
              }
              protectionLevel={
                wallet.owner.custody === "namera-managed" ? wallet.owner.protectionLevel : undefined
              }
            />
          ),
        },
        { id: "network", key: "Network", value: <ChainDisplay chainId="eip155:1" /> },
        { id: "service", key: "Service", value: "avtr.cc upload" },
        {
          id: "images",
          key: "Updating",
          value: [draft.avatar ? "Avatar" : null, draft.header ? "Header" : null]
            .filter(Boolean)
            .join(" and "),
        },
      ]}
      footer={
        approvalError ? (
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span>Account approval unavailable.</span>
            <Button size="sm" variant="tertiary" onPress={onRetryApproval}>
              Retry
            </Button>
          </div>
        ) : null
      }
    />
  );
}
