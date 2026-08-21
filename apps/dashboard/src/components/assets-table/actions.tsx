import type { Key } from "react";

import { Button, Dropdown, Label } from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  Copy01Icon,
  HugeiconsIcon,
  MoreHorizontalIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { copyTextWithFeedback } from "@/lib/clipboard";

import { getAssetExplorerUrl, type AssetTableRow } from "./data";

export function AssetActions({ asset }: { asset: AssetTableRow }) {
  const explorerUrl = getAssetExplorerUrl(asset);
  const handleAction = useEventCallback((key: Key) => {
    if (key === "explorer" && explorerUrl !== undefined) {
      window.open(explorerUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (key !== "copy-address" || asset.tokenAddress === null) return;

    void copyTextWithFeedback(asset.tokenAddress, {
      success: { title: "Token address copied" },
      error: { title: "Couldn't copy token address" },
    });
  });

  return (
    <Dropdown>
      <Button isIconOnly aria-label="Asset actions" size="sm" variant="tertiary">
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </Button>
      <Dropdown.Popover className="min-w-48" placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          {explorerUrl === undefined ? null : (
            <Dropdown.Item id="explorer" textValue="View on explorer">
              <HugeiconsIcon className="size-4 text-muted" icon={ArrowUpRight01Icon} />
              <Label>View on explorer</Label>
            </Dropdown.Item>
          )}
          {asset.tokenAddress === null ? null : (
            <Dropdown.Item id="copy-address" textValue="Copy token address">
              <HugeiconsIcon className="size-4 text-muted" icon={Copy01Icon} />
              <Label>Copy token address</Label>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
