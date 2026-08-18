import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Dropdown, Label } from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  Copy01Icon,
  HugeiconsIcon,
  MoreHorizontalIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { showErrorToast, showSuccessToast } from "@/lib/toasts";

type AccountActionsProps = {
  account: WalletResponse;
};

export function AccountActions({ account }: AccountActionsProps) {
  const copyValue = useEventCallback((value: string, title: string) => {
    void navigator.clipboard.writeText(value).then(
      () => showSuccessToast({ title }),
      () => showErrorToast(undefined, { title: "Couldn't copy to clipboard" }),
    );
  });
  const handleAction = useEventCallback((key: string | number) => {
    if (key === "copy-id") {
      copyValue(account.id, "Wallet ID copied to clipboard");
      return;
    }

    if (key === "copy-address") {
      copyValue(account.address, "Wallet address copied to clipboard");
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
            <Dropdown.Item id="copy-id" textValue="Copy wallet ID">
              <HugeiconsIcon className="size-4 text-muted" icon={Copy01Icon} />
              <Label>Copy wallet ID</Label>
            </Dropdown.Item>
            <Dropdown.Item id="copy-address" textValue="Copy wallet address">
              <HugeiconsIcon className="size-4 text-muted" icon={Copy01Icon} />
              <Label>Copy wallet address</Label>
            </Dropdown.Item>
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
