import { type Key } from "react";

import type { ExecutionListItemResponse } from "@namera-ai/protocol/dto";
import { Button, Dropdown, Label } from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  Copy01Icon,
  HugeiconsIcon,
  MoreHorizontalIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { getTransactionUrl } from "./data";

type ExecutionActionsProps = {
  execution: ExecutionListItemResponse;
};

export function ExecutionActions({ execution }: ExecutionActionsProps) {
  const transactionUrl = getTransactionUrl(execution);
  const transactionHash = execution.execution.data.transactionHash;

  const handleAction = useEventCallback((key: Key) => {
    if (key === "open-transaction" && transactionUrl !== undefined) {
      window.open(transactionUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const copy =
      key === "copy-transaction-hash"
        ? { label: "Transaction hash", value: transactionHash }
        : key === "copy-execution-id"
          ? { label: "Execution ID", value: execution.execution.id }
          : undefined;
    if (copy === undefined) return;

    void navigator.clipboard.writeText(copy.value).then(
      () => showSuccessToast({ title: `${copy.label} copied` }),
      () => showErrorToast(undefined, { title: `Couldn't copy ${copy.label.toLowerCase()}` }),
    );
  });

  return (
    <Dropdown>
      <Button
        isIconOnly
        aria-label={`Actions for execution ${execution.execution.id}`}
        size="sm"
        variant="tertiary"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </Button>
      <Dropdown.Popover className="min-w-52" placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          {transactionUrl === undefined ? null : (
            <Dropdown.Item id="open-transaction" textValue="View transaction">
              <HugeiconsIcon className="size-4 text-muted" icon={ArrowUpRight01Icon} />
              <Label>View transaction</Label>
            </Dropdown.Item>
          )}
          <Dropdown.Item id="copy-transaction-hash" textValue="Copy transaction hash">
            <HugeiconsIcon className="size-4 text-muted" icon={Copy01Icon} />
            <Label>Copy transaction hash</Label>
          </Dropdown.Item>
          <Dropdown.Item id="copy-execution-id" textValue="Copy execution ID">
            <HugeiconsIcon className="size-4 text-muted" icon={Copy01Icon} />
            <Label>Copy execution ID</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export type { ExecutionActionsProps };
