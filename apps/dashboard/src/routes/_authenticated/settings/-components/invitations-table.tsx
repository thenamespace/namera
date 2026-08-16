import { useMemo } from "react";

import { DateTime } from "effect";

import type { GetInvitationResponse } from "@namera-ai/protocol/dto";
import { Button, DataGrid, Typography, type DataGridColumn } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { DateDisplay, EmailDisplay, OrganizationRoleDisplay } from "@/components/display";
import { useCancelInvitation, useOrganizationInvitations } from "@/hooks/auth";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const invitationCollator = new Intl.Collator(undefined, { sensitivity: "base" });

function CancelInvitationButton({ invitation }: { invitation: GetInvitationResponse }) {
  const cancelInvitation = useCancelInvitation({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t cancel invitation",
        description: "The invitation is still active.",
      }),
    onSuccess: () => showSuccessToast({ title: "Invitation canceled" }),
  });

  const handleCancel = useEventCallback(() => {
    cancelInvitation.mutate({
      payload: { invitationId: invitation.invitation.id },
    });
  });

  return (
    <Button
      isDisabled={cancelInvitation.isPending}
      onPress={handleCancel}
      size="sm"
      variant="danger-soft"
    >
      {cancelInvitation.isPending ? "Cancelling…" : "Cancel"}
    </Button>
  );
}

const columns: DataGridColumn<GetInvitationResponse>[] = [
  {
    allowsSorting: true,
    cell: ({ invitation }) => <EmailDisplay email={invitation.email} />,
    header: "Email",
    id: "email",
    isRowHeader: true,
    minWidth: 220,
    sortFn: (left, right) =>
      invitationCollator.compare(left.invitation.email, right.invitation.email),
  },
  {
    allowsSorting: true,
    cell: ({ organizationRole }) => <OrganizationRoleDisplay role={organizationRole} />,
    header: "Role",
    id: "role",
    minWidth: 140,
    sortFn: (left, right) =>
      invitationCollator.compare(
        left.organizationRole.metadata.name,
        right.organizationRole.metadata.name,
      ),
  },
  {
    allowsSorting: true,
    cell: ({ invitation }) => <DateDisplay label="Expires" value={invitation.expiresAt} />,
    header: "Expires",
    id: "expiresAt",
    minWidth: 160,
    sortFn: (left, right) =>
      DateTime.toEpochMillis(left.invitation.expiresAt) -
      DateTime.toEpochMillis(right.invitation.expiresAt),
  },
  {
    align: "end",
    cell: (invitation) => <CancelInvitationButton invitation={invitation} />,
    header: "",
    id: "actions",
    pinned: "end",
    width: 100,
  },
];

const getInvitationId = ({ invitation }: GetInvitationResponse) => invitation.id;
const renderEmptyState = () => "No pending invitations.";

type InvitationsTableProps = {
  canCancel: boolean;
  initialInvitations: ReadonlyArray<GetInvitationResponse>;
};

export function InvitationsTable({ canCancel, initialInvitations }: InvitationsTableProps) {
  const invitations = useOrganizationInvitations();
  const visibleColumns = canCancel ? columns : columns.slice(0, -1);
  const invitationData = invitations.data ?? initialInvitations;
  const data = useMemo(() => [...invitationData], [invitationData]);

  if (invitations.isLoading) return <Typography color="muted">Loading invitations…</Typography>;
  if (invitations.isError) {
    return <Typography className="text-danger">Couldn’t load organization invitations.</Typography>;
  }

  return (
    <DataGrid
      aria-label="Pending organization invitations"
      columns={visibleColumns}
      contentClassName="min-w-[680px]"
      data={data}
      getRowId={getInvitationId}
      renderEmptyState={renderEmptyState}
      variant="secondary"
    />
  );
}
