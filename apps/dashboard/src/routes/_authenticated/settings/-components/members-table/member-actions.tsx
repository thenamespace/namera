import { useState, type Key } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  UpdateOrganizationMemberRoleRequest,
  type GetOrganizationMemberResponse,
  type GetOrganizationRoleResponse,
} from "@namera-ai/protocol/dto";
import {
  Button,
  Dropdown,
  FieldError,
  Form,
  Label,
  ListBox,
  Modal,
  Select,
  Typography,
  toast,
} from "@namera-ai/ui";
import { HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";
import { useController, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { hasPermissions } from "@/components/permission";
import { useCurrentUser, useRemoveMember, useUpdateMemberRole } from "@/hooks/auth";

const memberUpdatePermission = ["member:update"] as const;
const memberRemovePermission = ["member:remove"] as const;

type MemberActionsProps = {
  member: GetOrganizationMemberResponse;
  assignableRoles: ReadonlyArray<GetOrganizationRoleResponse>;
};

type UpdateRoleInput = typeof UpdateOrganizationMemberRoleRequest.Encoded;
type UpdateRoleOutput = typeof UpdateOrganizationMemberRoleRequest.Type;

export function MemberActions({ member, assignableRoles }: MemberActionsProps) {
  const [dialog, setDialog] = useState<"role" | "remove" | null>(null);
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const currentUser = useCurrentUser();
  const form = useForm<UpdateRoleInput, unknown, UpdateRoleOutput>({
    defaultValues: {
      organizationMemberId: member.organizationMember.id,
      organizationRoleId: member.organizationRole.id,
    },
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(UpdateOrganizationMemberRoleRequest),
    ),
  });
  const role = useController({ control: form.control, name: "organizationRoleId" });
  const name = member.user.metadata.name ?? member.user.email;
  const canUpdate = hasPermissions(
    currentUser.data?.role.permissions ?? [],
    memberUpdatePermission,
  );
  const canRemove = hasPermissions(
    currentUser.data?.role.permissions ?? [],
    memberRemovePermission,
  );

  const handleAction = useEventCallback((key: Key) => {
    if (key === "update-role") setDialog("role");
    if (key === "remove-member") setDialog("remove");
  });

  const handleRoleUpdate = form.handleSubmit(async (payload) => {
    try {
      await updateRole.mutateAsync({ payload });
      toast.success("Member role updated");
      setDialog(null);
    } catch {
      toast.danger("Couldn’t update the member role.");
    }
  });

  const handleRemove = useEventCallback(async () => {
    try {
      await removeMember.mutateAsync({
        payload: { organizationMemberId: member.organizationMember.id },
      });
      toast.success("Member removed");
      setDialog(null);
    } catch {
      toast.danger("Couldn’t remove the member.");
    }
  });

  const handleRoleModalChange = useEventCallback((open: boolean) => {
    setDialog(open ? "role" : null);
  });

  const handleRemoveModalChange = useEventCallback((open: boolean) => {
    setDialog(open ? "remove" : null);
  });

  if (
    (!canUpdate && !canRemove) ||
    !assignableRoles.some((candidateRole) => candidateRole.id === member.organizationRole.id)
  ) {
    return null;
  }

  return (
    <>
      <Dropdown>
        <Button isIconOnly aria-label={`Actions for ${name}`} size="sm" variant="tertiary">
          <HugeiconsIcon icon={MoreHorizontalIcon} />
        </Button>
        <Dropdown.Popover className="min-w-44">
          <Dropdown.Menu onAction={handleAction}>
            {canUpdate ? (
              <Dropdown.Item id="update-role" textValue="Update role">
                <Label>Update role</Label>
              </Dropdown.Item>
            ) : null}
            {canRemove ? (
              <Dropdown.Item id="remove-member" textValue="Remove member" variant="danger">
                <Label>Remove member</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <Modal isOpen={canUpdate && dialog === "role"} onOpenChange={handleRoleModalChange}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Form onSubmit={handleRoleUpdate} validationBehavior="aria">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Update role</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="grid gap-5">
                  <Typography color="muted">Choose a new role for {name}.</Typography>
                  <Select
                    fullWidth
                    isInvalid={role.fieldState.invalid}
                    isRequired
                    name={role.field.name}
                    onSelectionChange={role.field.onChange}
                    selectedKey={role.field.value}
                    variant="secondary"
                  >
                    <Label>Role</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox items={assignableRoles}>
                        {(item) => (
                          <ListBox.Item id={item.id} textValue={item.metadata.name}>
                            {item.metadata.name}
                          </ListBox.Item>
                        )}
                      </ListBox>
                    </Select.Popover>
                    <FieldError>{role.fieldState.error?.message}</FieldError>
                  </Select>
                </Modal.Body>
                <Modal.Footer>
                  <Button fullWidth isDisabled={updateRole.isPending} type="submit">
                    {updateRole.isPending ? "Updating…" : "Update role"}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={canRemove && dialog === "remove"} onOpenChange={handleRemoveModalChange}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Remove member</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Typography color="muted">
                  Remove {name} from this organization? Their active access will be revoked.
                </Typography>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  fullWidth
                  isDisabled={removeMember.isPending}
                  onPress={handleRemove}
                  variant="danger"
                >
                  {removeMember.isPending ? "Removing…" : "Remove member"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

export type { MemberActionsProps };
