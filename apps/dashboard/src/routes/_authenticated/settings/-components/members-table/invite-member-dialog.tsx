// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useEffect, useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { InviteMemberRequest } from "@namera-ai/protocol/dto";
import type { GetOrganizationRoleResponse } from "@namera-ai/protocol/dto";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  ListBox,
  Modal,
  Select,
  Typography,
  toast,
} from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { useAssignableOrganizationRoles, useInviteMember } from "@/hooks/auth";

type InviteMemberInput = typeof InviteMemberRequest.Encoded;
type InviteMemberOutput = typeof InviteMemberRequest.Type;

export function InviteMemberDialog({
  initialRoles,
}: {
  initialRoles: ReadonlyArray<GetOrganizationRoleResponse>;
}) {
  const roles = useAssignableOrganizationRoles();
  const inviteMember = useInviteMember();
  const inviteRoles = roles.data ?? initialRoles;
  const defaultValues: InviteMemberInput = {
    email: "",
    organizationRoleId: inviteRoles[0]?.id ?? "",
  };
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<InviteMemberInput, unknown, InviteMemberOutput>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(InviteMemberRequest)),
  });
  useEffect(() => {
    if (!form.getValues("organizationRoleId") && inviteRoles[0]) {
      form.setValue("organizationRoleId", inviteRoles[0].id);
    }
  }, [form, inviteRoles]);

  const handleOpenChange = useEventCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) form.reset(defaultValues);
  });
  const handleSubmit = form.handleSubmit(async (payload) => {
    try {
      await inviteMember.mutateAsync({ payload });
      toast.success("Invitation sent");
      handleOpenChange(false);
    } catch {
      toast.danger("Couldn’t send the invitation.");
    }
  });

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button className="self-start sm:self-auto" size="sm" type="button">
        <HugeiconsIcon icon={Add01Icon} />
        Invite
      </Button>

      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <form id="invite-member-form" noValidate onSubmit={handleSubmit}>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Invite member</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="grid gap-5">
                <Typography color="muted">Send an invitation to join this organization.</Typography>
                <FieldGroup>
                  <Controller
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="invite-member-email">Email address</FieldLabel>
                        <Input
                          {...field}
                          id="invite-member-email"
                          aria-invalid={fieldState.invalid}
                          autoComplete="email"
                          fullWidth
                          inputMode="email"
                          placeholder="name@company.com"
                          spellCheck={false}
                          type="email"
                          variant="secondary"
                        />
                        {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                      </Field>
                    )}
                  />

                  <Controller
                    control={form.control}
                    name="organizationRoleId"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel id="invite-member-role-label">Role</FieldLabel>
                        <Select
                          aria-labelledby="invite-member-role-label"
                          fullWidth
                          isDisabled={roles.isLoading || inviteMember.isPending}
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
                            <ListBox items={inviteRoles}>
                              {(item) => (
                                <ListBox.Item id={item.id} textValue={item.metadata.name}>
                                  <div className="grid gap-0.5">
                                    <Typography>{item.metadata.name}</Typography>
                                    <Typography className="text-xs" color="muted">
                                      {item.metadata.description}
                                    </Typography>
                                  </div>
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
                  form="invite-member-form"
                  fullWidth
                  isDisabled={inviteMember.isPending}
                  type="submit"
                >
                  {inviteMember.isPending ? "Sending…" : "Send invite"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
