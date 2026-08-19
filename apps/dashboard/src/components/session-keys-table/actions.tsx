import { useNavigate } from "@tanstack/react-router";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Button, Dropdown, Label } from "@namera-ai/ui";
import { Copy01Icon, HugeiconsIcon, Key01Icon, MoreHorizontalIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { showErrorToast, showSuccessToast } from "@/lib/toasts";

type SessionKeyActionsProps = {
  sessionKey: SessionKeyResponse;
};

export function SessionKeyActions({ sessionKey }: SessionKeyActionsProps) {
  const navigate = useNavigate();
  const handleAction = useEventCallback((key: string | number) => {
    if (key === "open-session-key") {
      void navigate({
        to: "/session-key/$sessionKeyId/overview",
        params: { sessionKeyId: sessionKey.id },
      });
      return;
    }

    if (key === "copy-id") {
      void navigator.clipboard.writeText(sessionKey.id).then(
        () => showSuccessToast({ title: "Session key ID copied" }),
        () => showErrorToast(undefined, { title: "Couldn't copy session key ID" }),
      );
    }
  });

  return (
    <Dropdown>
      <Button
        isIconOnly
        aria-label={`Actions for ${sessionKey.metadata.name}`}
        size="sm"
        variant="tertiary"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </Button>
      <Dropdown.Popover className="min-w-52" placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="open-session-key" textValue="Open session key">
            <HugeiconsIcon className="size-4 text-muted" icon={Key01Icon} />
            <Label>Open session key</Label>
          </Dropdown.Item>
          <Dropdown.Item id="copy-id" textValue="Copy session key ID">
            <HugeiconsIcon className="size-4 text-muted" icon={Copy01Icon} />
            <Label>Copy session key ID</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export type { SessionKeyActionsProps };
