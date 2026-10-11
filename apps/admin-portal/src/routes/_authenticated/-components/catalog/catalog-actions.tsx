import { useCallback, type Key } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Button, Dropdown, Label, toast } from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  Copy01Icon,
  HugeiconsIcon,
  MoreHorizontalIcon,
} from "@namera-ai/ui/icons";

import type { CatalogRecord } from "./catalog-display";

export async function copyCatalogValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.danger(`Couldn’t copy ${label.toLowerCase()}`, {
      description: "Select and copy the value manually.",
    });
  }
}

export function CatalogActions({ record }: { record: CatalogRecord }) {
  const navigate = useNavigate();
  const handleAction = useCallback(
    (key: Key) => {
      if (key === "copy") void copyCatalogValue(record.id, "Catalog ID");
      if (key === "view")
        void navigate({ to: "/catalog/$catalogId", params: { catalogId: record.id } });
    },
    [navigate, record.id],
  );
  return (
    <Dropdown>
      <Button
        size="sm"
        variant="tertiary"
        isIconOnly
        aria-label={`Actions for ${record.data.display.name}`}
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="view" textValue="View page">
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
            <Label>View page</Label>
          </Dropdown.Item>
          <Dropdown.Item id="copy" textValue="Copy ID">
            <HugeiconsIcon className="size-4" icon={Copy01Icon} />
            <Label>Copy ID</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
