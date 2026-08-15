import { useState, type Key } from "react";

import type { ApiKeyResponse } from "@namera-ai/protocol/dto";
import { AlertDialog, Button, Dropdown, Label, toast } from "@namera-ai/ui";
import { HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { useRevokeApiKey } from "@/hooks/api-key";

type ApiKeyActionsProps = {
  apiKey: ApiKeyResponse;
};

export function ApiKeyActions({ apiKey }: ApiKeyActionsProps) {
  const revokeApiKey = useRevokeApiKey();
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = useEventCallback((key: Key) => {
    if (key === "revoke") setIsOpen(true);
  });
  const handleRevoke = useEventCallback(async () => {
    try {
      await revokeApiKey.mutateAsync({ params: { apiKeyId: apiKey.id } });
      toast.success("API key revoked");
      setIsOpen(false);
    } catch {
      toast.danger("Couldn’t revoke the API key.");
    }
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
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Revoke {apiKey.metadata.name}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                This API key will stop working immediately. All of its session-key grants will be
                revoked. This action cannot be undone.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button isDisabled={revokeApiKey.isPending} variant="danger" onPress={handleRevoke}>
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
