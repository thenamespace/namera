// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { WaitlistEntry } from "@namera-ai/protocol/model";
import { AlertDialog, Button, toast } from "@namera-ai/ui";

import { useAcceptWaitlist } from "@/hooks/waitlist";
import { teamErrorMessage } from "@/lib/team-feedback";

export function AcceptWaitlistDialog({
  entry,
  onClose,
}: {
  entry: WaitlistEntry;
  onClose: () => void;
}) {
  const accept = useAcceptWaitlist({
    onError: (error) =>
      toast.danger("Couldn’t accept entry", { description: teamErrorMessage(error) }),
    onSuccess: ({ accepted }) => {
      toast.success(
        accepted ? "Waitlist entry accepted" : "Entry is no longer pending",
        accepted ? { description: "The invitation email is queued for delivery." } : {},
      );
      onClose();
    },
  });
  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isOpen
        onOpenChange={(open) => {
          if (!open && !accept.isPending) onClose();
        }}
      >
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>Accept waitlist entry?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="grid gap-3">
              <p className="break-all text-sm">{entry.email}</p>
              <p className="text-muted text-sm">
                This will create a single-use invite bound to this email, queue an invitation email,
                and mark the entry as completed. The invite expires in 7 days.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" isDisabled={accept.isPending} onPress={onClose}>
                Cancel
              </Button>
              <Button
                isDisabled={accept.isPending}
                onPress={() => accept.mutate({ params: { id: entry.id } })}
              >
                {accept.isPending ? "Accepting…" : "Accept and send invite"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
