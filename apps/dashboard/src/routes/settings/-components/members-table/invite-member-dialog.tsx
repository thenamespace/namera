import { useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { InviteMemberRequest } from "@namera-ai/protocol/dto";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  Typography,
} from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { useController, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { demoInviteRoles } from "./data";

type InviteMemberInput = typeof InviteMemberRequest.Encoded;
type InviteMemberOutput = typeof InviteMemberRequest.Type;

const defaultValues: InviteMemberInput = {
  email: "",
  organizationRoleId: "0198a9f6-1000-7000-8000-000000000032",
};

export function InviteMemberDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<InviteMemberInput, unknown, InviteMemberOutput>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(InviteMemberRequest)),
  });
  const email = useController({ control: form.control, name: "email" });
  const role = useController({ control: form.control, name: "organizationRoleId" });
  const handleOpenChange = useEventCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) form.reset(defaultValues);
  });
  const handleSubmit = form.handleSubmit(() => handleOpenChange(false));

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button className="self-start sm:self-auto" size="sm" type="button">
        <HugeiconsIcon icon={Add01Icon} />
        Invite
      </Button>

      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Form onSubmit={handleSubmit} validationBehavior="aria">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Invite member</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="grid gap-5">
                <Typography color="muted">Send an invitation to join this organization.</Typography>

                <TextField
                  fullWidth
                  isInvalid={email.fieldState.invalid}
                  isRequired
                  name={email.field.name}
                  onChange={email.field.onChange}
                  type="email"
                  value={email.field.value}
                >
                  <Label>Email address</Label>
                  <Input
                    autoComplete="email"
                    inputMode="email"
                    onBlur={email.field.onBlur}
                    placeholder="name@company.com"
                    ref={email.field.ref}
                    spellCheck={false}
                  />
                  <FieldError>{email.fieldState.error?.message}</FieldError>
                </TextField>

                <Select
                  fullWidth
                  isInvalid={role.fieldState.invalid}
                  isRequired
                  name={role.field.name}
                  selectedKey={role.field.value}
                  onSelectionChange={role.field.onChange}
                >
                  <Label>Role</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox items={demoInviteRoles}>
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
                  <FieldError>{role.fieldState.error?.message}</FieldError>
                </Select>
              </Modal.Body>
              <Modal.Footer>
                <Button fullWidth type="submit">
                  Send invite
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
