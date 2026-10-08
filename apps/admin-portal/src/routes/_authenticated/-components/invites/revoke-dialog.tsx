// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { BetaInviteListEntry } from "@namera-ai/protocol/model";
import { AlertDialog, Button, toast } from "@namera-ai/ui";

import { useRevokeInvite } from "@/hooks/invites";
import { inviteNeedsSignIn, showInviteError } from "@/lib/invite-feedback";

export function RevokeInviteDialog({
  invite,
  onClose,
}: {
  invite: BetaInviteListEntry;
  onClose: () => void;
}) {
  const revoke = useRevokeInvite({
    onError: showInviteError,
    onSuccess: ({ revoked }) => {
      toast.success(revoked ? "Invite code revoked" : "Invite code is no longer active");
      onClose();
    },
  });
  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isOpen
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) onClose();
        }}
      >
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>Revoke invite code?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="grid gap-3">
              <p className="text-muted text-sm">
                This code{invite.email ? ` for ${invite.email}` : ""} will no longer let someone
                join Namera. This cannot be undone.
              </p>
              <p className="text-muted break-all text-xs">Invite reference: {invite.id}</p>
              {inviteNeedsSignIn(revoke.error) ? (
                <a href="/auth?reauth=true" className="text-accent text-sm underline">
                  Sign in again to continue
                </a>
              ) : null}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" isDisabled={revoke.isPending} onPress={onClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isDisabled={revoke.isPending}
                onPress={() => revoke.mutate({ params: { id: invite.id } })}
              >
                {revoke.isPending ? "Revoking…" : "Revoke code"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
