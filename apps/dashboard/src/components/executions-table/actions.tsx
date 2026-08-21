import { type Key } from "react";

import { useNavigate } from "@tanstack/react-router";

import type { ExecutionListItemResponse } from "@namera-ai/protocol/dto";
import { Button, Dropdown, Label } from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  HugeiconsIcon,
  MoreHorizontalIcon,
  ViewIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { CopyDropdownItem } from "@/components/copy-icon-button";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { getTransactionUrl } from "./data";

type ExecutionActionsProps = {
  execution: ExecutionListItemResponse;
};

const showTransactionHashCopied = () =>
  showSuccessToast({ title: "Transaction hash copied to clipboard" });
const showExecutionIdCopied = () => showSuccessToast({ title: "Execution ID copied to clipboard" });
const showTransactionHashCopyError = () =>
  showErrorToast(undefined, { title: "Couldn't copy transaction hash" });
const showExecutionIdCopyError = () =>
  showErrorToast(undefined, { title: "Couldn't copy execution ID" });

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
          <CopyDropdownItem
            id="copy-transaction-hash"
            label="Copy transaction hash"
            value={transactionHash}
            onCopyError={showTransactionHashCopyError}
            onCopySuccess={showTransactionHashCopied}
          />
          <CopyDropdownItem
            id="copy-execution-id"
            label="Copy execution ID"
            value={execution.details.id}
            onCopyError={showExecutionIdCopyError}
            onCopySuccess={showExecutionIdCopied}
          />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export type { ExecutionActionsProps };
