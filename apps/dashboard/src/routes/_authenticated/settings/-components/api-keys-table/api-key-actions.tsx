import { useState, type Key } from "react";

import type { ApiKeyResponse } from "@namera-ai/protocol/dto";
import { AlertDialog, Button, Dropdown, Label } from "@namera-ai/ui";
import { HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { useRevokeApiKey } from "@/hooks/api-key";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

type ApiKeyActionsProps = {
  apiKey: ApiKeyResponse;
};

export function ApiKeyActions({ apiKey }: ApiKeyActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const revokeApiKey = useRevokeApiKey({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t revoke API key",
        description: "The key is still active. Try again.",
      }),
    onSuccess: () => {
      showSuccessToast({
        title: "API key revoked",
        description: "Its session-key grants can no longer be used.",
      });
      setIsOpen(false);
    },
  });

  const handleAction = useEventCallback((key: Key) => {
    if (key === "revoke") setIsOpen(true);
  });
  const handleRevoke = useEventCallback(() => {
    revokeApiKey.mutate({ params: { apiKeyId: apiKey.id } });
  });

  if (apiKey.revokedAt !== null) return null;

  return (
    <>
      <Dropdown>
        <Button
          isIconOnly
          aria-label={`Actions for ${apiKey.metadata.name}`}
          size="sm"
          variant="tertiary"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} />
        </Button>
        <Dropdown.Popover className="min-w-40">
          <Dropdown.Menu onAction={handleAction}>
            <Dropdown.Item id="revoke" textValue="Revoke API key" variant="danger">
              <Label>Revoke API key</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <AlertDialog>
        <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <AlertDialog.Container size="md">
            <AlertDialog.Dialog className="rounded-xl">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Revoke {apiKey.metadata.name}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                This key loses all session-key access immediately. This cannot be undone.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary" size="sm">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  isDisabled={revokeApiKey.isPending}
                  variant="danger"
                  onPress={handleRevoke}
                >
                  {revokeApiKey.isPending ? "Revoking…" : "Revoke API key"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}
