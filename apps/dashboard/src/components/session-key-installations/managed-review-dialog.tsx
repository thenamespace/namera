// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { EvmSessionPermission } from "@namera-ai/protocol/evm";
import { Button, Modal, Typography } from "@namera-ai/ui";

import { ChainDisplay, EvmAddressDisplay, WalletOwnerDisplay } from "@/components/display";
import { onchainPermissionCatalog } from "@/components/policy/evm/onchain/catalog";
import { OnchainPermissionSummary } from "@/components/policy/evm/onchain/summary";

export function ManagedReviewDialog({
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
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) confirm(false);
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {kind === "install" ? "Approve network access" : "Remove network access"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid gap-4">
              <div className="grid gap-2">
                <Typography.Paragraph size="sm">
                  {session.wallet.metadata.name} · {session.metadata.name}
                </Typography.Paragraph>
                <WalletOwnerDisplay custody="namera-managed" provider="1claw" />
                <ChainDisplay chainId={installation.chainId} />
                <EvmAddressDisplay address={session.wallet.address} />
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  Session signer <EvmAddressDisplay address={authorization.signerAddress} />
                </div>
              </div>
              <div className="grid gap-2">
                {authorization.permissions.map((permission) => (
                  <div key={JSON.stringify(Schema.encodeSync(EvmSessionPermission)(permission))}>
                    <Typography.Paragraph size="sm" weight="medium">
                      {onchainPermissionCatalog[permission.type].name}
                    </Typography.Paragraph>
                    <div className="text-sm text-muted">
                      <OnchainPermissionSummary
                        permission={Schema.encodeSync(EvmSessionPermission)(permission)}
                      />
                    </div>
                  </div>
                ))}
                <Typography.Paragraph size="sm" color="muted">
                  Starts{" "}
                  {authorization.validAfter === 0
                    ? "immediately"
                    : new Date(authorization.validAfter * 1000).toLocaleString()}
                  . Expires {new Date(authorization.validUntil * 1000).toLocaleString()}.
                </Typography.Paragraph>
                <Typography.Paragraph size="sm" color="muted">
                  {authorization.allowSignatures
                    ? "Signature authority is included. Onchain removal is required to revoke it."
                    : "No onchain signature authority."}
                </Typography.Paragraph>
              </div>
              <Typography.Paragraph size="sm" color="muted">
                {kind === "install"
                  ? "1Claw will sign this permission change for your account. Access begins only after onchain confirmation."
                  : "1Claw will sign the onchain removal. API access remains revoked while confirmation is pending."}{" "}
                Gas is sponsored within your workspace’s available allowance.
              </Typography.Paragraph>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => confirm(false)}>
                Cancel
              </Button>
              <Button
                variant={kind === "uninstall" ? "danger" : "primary"}
                onPress={() => confirm(true)}
              >
                {kind === "install" ? "Approve with 1Claw" : "Remove with 1Claw"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
