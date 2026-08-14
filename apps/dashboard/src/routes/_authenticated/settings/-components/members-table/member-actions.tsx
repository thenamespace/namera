// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Label,
  ListBox,
  Modal,
  Select,
  Typography,
  toast,
} from "@namera-ai/ui";
import { HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";
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
              <form id="update-member-role-form" noValidate onSubmit={handleRoleUpdate}>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Update role</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="grid gap-5">
                  <Typography color="muted">Choose a new role for {name}.</Typography>
                  <FieldGroup>
                    <Controller
                      control={form.control}
                      name="organizationRoleId"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel id="update-member-role-label">Role</FieldLabel>
                          <Select
                            aria-labelledby="update-member-role-label"
                            fullWidth
                            isInvalid={fieldState.invalid}
                            isRequired
                            name={field.name}
                            onSelectionChange={field.onChange}
                            selectedKey={field.value}
                            variant="secondary"
                          >
                            <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
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
                          </Select>
                          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                        </Field>
                      )}
                    />
                  </FieldGroup>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    form="update-member-role-form"
                    fullWidth
                    isDisabled={updateRole.isPending}
                    type="submit"
                  >
                    {updateRole.isPending ? "Updating…" : "Update role"}
                  </Button>
                </Modal.Footer>
              </form>
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
