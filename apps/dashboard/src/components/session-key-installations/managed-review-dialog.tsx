// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-jsx-as-prop
import type { SessionKeyResponse } from "@namera-ai/protocol/dto";

import {
  ChainDisplay,
  EvmAddressDisplay,
  NamespaceDisplay,
  WalletOwnerDisplay,
} from "@/components/display";
import { TransactionOverview } from "@/components/transaction-overview";
import { isOneClawAccount } from "@/lib/session-owner";

export function SessionKeyReviewDialog({
  session,
  installation,
  kind,
  isOpen,
  confirm,
}: {
  session: SessionKeyResponse;
  installation: SessionKeyResponse["installations"][number];
  kind: "install" | "uninstall";
  isOpen: boolean;
  confirm: (confirmed: boolean) => void;
}) {
  const authorization = installation.authorization;
  const removal = kind === "uninstall";
  const managed = isOneClawAccount(session.wallet);
  return (
    <TransactionOverview
      isOpen={isOpen}
      title={removal ? "Remove network access" : "Approve network access"}
      description={
        removal
          ? `Remove ${session.metadata.name}’s onchain permissions for this network.`
          : `Allow ${session.metadata.name} to use its configured permissions on this network.`
      }
      confirmText={removal ? "Confirm removal" : "Confirm and approve"}
      confirmVariant={removal ? "danger" : "primary"}
      onConfirm={() => confirm(true)}
      onCancel={() => confirm(false)}
      rows={[
        { id: "account", key: "Account", value: session.wallet.metadata.name },
        {
          id: "namespace",
          key: "Namespace",
          value: <NamespaceDisplay namespace={session.wallet.namespace} />,
        },
        {
          id: "owner",
          key: "Owner",
          value: managed ? (
            <WalletOwnerDisplay custody="namera-managed" provider="1claw" />
          ) : (
            <WalletOwnerDisplay custody="local" />
          ),
        },
        { id: "network", key: "Network", value: <ChainDisplay chainId={installation.chainId} /> },
        {
          id: "address",
          key: "Account address",
          value: <EvmAddressDisplay address={session.wallet.address} />,
        },
        {
          id: "signer",
          key: "Session signer",
          value: <EvmAddressDisplay address={authorization.signerAddress} />,
        },
      ]}
    />
  );
}
