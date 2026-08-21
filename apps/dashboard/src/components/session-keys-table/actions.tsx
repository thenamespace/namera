import { useState, type Key } from "react";

import { useNavigate } from "@tanstack/react-router";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { AlertDialog, Button, Dropdown, Label } from "@namera-ai/ui";
import { HugeiconsIcon, Key01Icon, MoreHorizontalIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { CopyDropdownItem } from "@/components/copy-icon-button";
import { hasPermissions } from "@/components/permission";
import { useCurrentUser } from "@/hooks/auth";
import { useRevokeSessionKey } from "@/hooks/session-key";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const sessionKeyRevokePermission = ["session-key:revoke"] as const;
const showSessionKeyIdCopied = () =>
  showSuccessToast({ title: "Session key ID copied to clipboard" });
const showSessionKeyIdCopyError = () =>
  showErrorToast(undefined, { title: "Couldn't copy session key ID" });

type SessionKeyActionsProps = {
  sessionKey: SessionKeyResponse;
  showOpenAction?: boolean;
};

export function SessionKeyActions({ sessionKey, showOpenAction = true }: SessionKeyActionsProps) {
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const revokeSessionKey = useRevokeSessionKey({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t revoke session key",
        description: "The session key is still active. Try again.",
      }),
    onSuccess: () => {
      showSuccessToast({
        title: "Session key revoked",
        description: "Its active grants can no longer authorize new operations.",
      });
      setIsRevokeOpen(false);
    },
  });
  const canRevoke = hasPermissions(
    currentUser.data?.role.permissions ?? [],
    sessionKeyRevokePermission,
  );
  const showRevoke = canRevoke && sessionKey.status === "active";

  const handleAction = useEventCallback((key: Key) => {
    if (key === "open-session-key") {
      void navigate({
        to: "/session-key/$sessionKeyId/overview",
        params: { sessionKeyId: sessionKey.id },
      });
      return;
    }

    if (key === "revoke") setIsRevokeOpen(true);
  });
  const handleRevoke = useEventCallback(() => {
    revokeSessionKey.mutate({ params: { sessionKeyId: sessionKey.id } });
  });

  return (
    <>
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
            {showOpenAction ? (
              <Dropdown.Item id="open-session-key" textValue="Open session key">
                <HugeiconsIcon className="size-4 text-muted" icon={Key01Icon} />
                <Label>Open session key</Label>
              </Dropdown.Item>
            ) : null}
            <CopyDropdownItem
              id="copy-id"
              label="Copy session key ID"
              value={sessionKey.id}
              onCopyError={showSessionKeyIdCopyError}
              onCopySuccess={showSessionKeyIdCopied}
            />
            {showRevoke ? (
              <Dropdown.Item id="revoke" textValue="Revoke session key" variant="danger">
                <HugeiconsIcon className="size-4" icon={Key01Icon} />
                <Label>Revoke session key</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <AlertDialog>
        <AlertDialog.Backdrop isOpen={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
          <AlertDialog.Container size="md">
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Revoke {sessionKey.metadata.name}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                This session key will stop authorizing new executions and signatures immediately.
                All active API key, CLI, and MCP grants to it will be revoked. This action cannot be
                undone.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button
                  isDisabled={revokeSessionKey.isPending}
                  variant="danger"
                  onPress={handleRevoke}
                >
                  {revokeSessionKey.isPending ? "Revoking…" : "Revoke session key"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}

export type { SessionKeyActionsProps };
