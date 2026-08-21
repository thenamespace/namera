import { useState, type Key } from "react";

import type { OAuthAuthorizationResponse } from "@namera-ai/protocol/dto";
import { AlertDialog, Button, Dropdown, Label } from "@namera-ai/ui";
import { HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { CopyDropdownItem } from "@/components/copy-icon-button";
import { useRevokeMcpAuthorization } from "@/hooks/auth";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const showAuthorizationIdCopied = () =>
  showSuccessToast({ title: "Authorization ID copied to clipboard" });
const showAuthorizationIdCopyError = () =>
  showErrorToast(undefined, { title: "Couldn’t copy authorization ID" });

type McpAuthorizationActionsProps = {
  authorization: OAuthAuthorizationResponse;
  canRevoke: boolean;
};

export function McpAuthorizationActions({
  authorization,
  canRevoke,
}: McpAuthorizationActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const revoke = useRevokeMcpAuthorization({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t revoke MCP access",
        description: "The connection is still active. Try again.",
      }),
    onSuccess: () => {
      showSuccessToast({
        title: "MCP access revoked",
        description: `${authorization.client.clientName} can no longer access Namera.`,
      });
      setIsOpen(false);
    },
  });
  const handleAction = useEventCallback((key: Key) => {
    if (key === "revoke") setIsOpen(true);
  });
  const handleRevoke = useEventCallback(() => {
    revoke.mutate({ payload: { authorizationId: authorization.id } });
  });

  return (
    <>
      <Dropdown>
        <Button
          isIconOnly
          aria-label={`Actions for ${authorization.client.clientName}`}
          size="sm"
          variant="tertiary"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} />
        </Button>
        <Dropdown.Popover className="min-w-48">
          <Dropdown.Menu onAction={handleAction}>
            <CopyDropdownItem
              id="copy"
              label="Copy authorization ID"
              value={authorization.id}
              onCopyError={showAuthorizationIdCopyError}
              onCopySuccess={showAuthorizationIdCopied}
            />
            {canRevoke && authorization.status === "active" ? (
              <Dropdown.Item id="revoke" textValue="Revoke access" variant="danger">
                <Label>Revoke access</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <AlertDialog>
        <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <AlertDialog.Container size="md">
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  Revoke access for {authorization.client.clientName}?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                This client will stop working immediately and lose access to every session key
                granted through this connection. This action cannot be undone.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button isDisabled={revoke.isPending} variant="danger" onPress={handleRevoke}>
                  {revoke.isPending ? "Revoking…" : "Revoke access"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}
