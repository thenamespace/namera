import { type Key } from "react";

import { useNavigate } from "@tanstack/react-router";

import type { ExecutionListItemResponse } from "@namera-ai/protocol/dto";
import { Button, Dropdown, Label } from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  Copy01Icon,
  HugeiconsIcon,
  MoreHorizontalIcon,
  ViewIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { copyTextWithFeedback } from "@/lib/clipboard";

import { getTransactionUrl } from "./data";

type ExecutionActionsProps = {
  execution: ExecutionListItemResponse;
};

export function ExecutionActions({ execution }: ExecutionActionsProps) {
  const navigate = useNavigate();
  const transactionUrl = getTransactionUrl(execution);
  const transactionHash = execution.details.transactionHash;

  const handleAction = useEventCallback((key: Key) => {
    if (key === "view-execution") {
      void navigate({
        to: "/execution/$executionId",
        params: { executionId: execution.details.id },
      });
      return;
    }
    if (key === "open-transaction" && transactionUrl !== undefined) {
      window.open(transactionUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const copy =
      key === "copy-transaction-hash"
        ? { label: "Transaction hash", value: transactionHash }
        : key === "copy-execution-id"
          ? { label: "Execution ID", value: execution.details.id }
          : undefined;
    if (copy === undefined) return;

    void copyTextWithFeedback(copy.value, {
      success: { title: `${copy.label} copied` },
      error: { title: `Couldn't copy ${copy.label.toLowerCase()}` },
    });
  });

  return (
    <Dropdown>
      <Button
        isIconOnly
        aria-label={`Actions for execution ${execution.details.id}`}
        size="sm"
        variant="tertiary"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </Button>
      <Dropdown.Popover className="min-w-52" placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="view-execution" textValue="View execution">
            <HugeiconsIcon className="size-4 text-muted" icon={ViewIcon} />
            <Label>View execution</Label>
          </Dropdown.Item>
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
