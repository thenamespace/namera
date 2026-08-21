import { useNavigate } from "@tanstack/react-router";

import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Dropdown, Label } from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  HugeiconsIcon,
  MoreHorizontalIcon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { CopyDropdownItem } from "@/components/copy-icon-button";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const showWalletIdCopied = () => showSuccessToast({ title: "Wallet ID copied to clipboard" });
const showWalletAddressCopied = () =>
  showSuccessToast({ title: "Wallet address copied to clipboard" });
const showCopyError = () => showErrorToast(undefined, { title: "Couldn't copy to clipboard" });

type AccountActionsProps = {
  account: WalletResponse;
};

export function AccountActions({ account }: AccountActionsProps) {
  const navigate = useNavigate();
  const handleAction = useEventCallback((key: string | number) => {
    if (key === "open-account") {
      void navigate({
        to: "/account/$accountId/overview",
        params: { accountId: account.id },
      });
      return;
    }

    if (key === "open-wallet") {
      window.open(
        `https://etherscan.io/address/${account.address}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  });

  return (
    <Dropdown>
      <Button
        isIconOnly
        aria-label={`Actions for ${account.metadata.name}`}
        size="sm"
        variant="tertiary"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </Button>
      <Dropdown.Popover className="min-w-52" placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Section>
            <Dropdown.Item id="open-account" textValue="Open account">
              <HugeiconsIcon className="size-4 text-muted" icon={Wallet01Icon} />
              <Label>Open account</Label>
            </Dropdown.Item>
            <CopyDropdownItem
              id="copy-id"
              label="Copy wallet ID"
              value={account.id}
              onCopyError={showCopyError}
              onCopySuccess={showWalletIdCopied}
            />
            <CopyDropdownItem
              id="copy-address"
              label="Copy wallet address"
              value={account.address}
              onCopyError={showCopyError}
              onCopySuccess={showWalletAddressCopied}
            />
          </Dropdown.Section>
          <Dropdown.Section>
            <Dropdown.Item id="open-wallet" textValue="View wallet on Etherscan">
              <HugeiconsIcon className="size-4 text-muted" icon={ArrowUpRight01Icon} />
              <Label>View wallet on Etherscan</Label>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export type { AccountActionsProps };
