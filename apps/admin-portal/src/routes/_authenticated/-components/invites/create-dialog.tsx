// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useEffect, useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { CreateBetaInvitesResponse } from "@namera-ai/protocol/dto";
import {
  Button,
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  Input,
  Modal,
  Select,
  ListBox,
  Label,
} from "@namera-ai/ui";
import { Controller, useForm, useWatch } from "react-hook-form";

import { useCreateInvites } from "@/hooks/invites";
import { inviteNeedsSignIn, showInviteError } from "@/lib/invite-feedback";

import { CreateInvitesForm, invitePayload } from "./create-form";
import { CreatedInvites } from "./created-invites";

export function CreateInvitesDialog({ onClose }: { onClose: () => void }) {
  const [created, setCreated] = useState<typeof CreateBetaInvitesResponse.Type | null>(null);
  const create = useCreateInvites({ onSuccess: setCreated, onError: showInviteError });
  const { reset } = create;
  useEffect(() => () => reset(), [reset]);
  const form = useForm<typeof CreateInvitesForm.Encoded, unknown, typeof CreateInvitesForm.Type>({
    defaultValues: { count: 1, expiresInDays: 7, email: "" },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateInvitesForm)),
  });
  const count = useWatch({ control: form.control, name: "count" });
  const pending = create.isPending;
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Modal.Backdrop isDismissable={!created && !pending} isKeyboardDismissDisabled={pending}>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger isDisabled={pending} />
            <Modal.Header>
              <Modal.Heading>
                {created ? "Invite codes created" : "Create invite codes"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid gap-5">
              {created ? (
                <CreatedInvites invites={created.invites} />
              ) : (
                <>
                  <p className="text-muted text-sm">
                    Each code can be used once. Copy the codes after creating them and share them
                    securely. No email is sent automatically.
                  </p>
                  {inviteNeedsSignIn(create.error) ? (
                    <a href="/auth?reauth=true" className="text-accent text-sm underline">
                      Sign in again to continue
                    </a>
                  ) : null}
                  <form
                    id="create-invites-form"
                    noValidate
                    onSubmit={form.handleSubmit((values) =>
                      create.mutate({ payload: invitePayload(values) }),
                    )}
                  >
                    <FieldGroup>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Controller
                          control={form.control}
                          name="count"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor="count">Number of codes</FieldLabel>
                              <Input
                                {...field}
                                id="count"
                                type="number"
                                min={1}
                                max={50}
                                value={Number.isNaN(field.value) ? "" : field.value}
                                onChange={(event) => {
                                  field.onChange(event.target.valueAsNumber);
                                  if (event.target.valueAsNumber !== 1) form.setValue("email", "");
                                }}
                                fullWidth
                                variant="secondary"
                                disabled={pending}
                                aria-invalid={fieldState.invalid}
                              />
                              {fieldState.invalid ? (
                                <FieldError errors={[fieldState.error]} />
                              ) : null}
                            </Field>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name="expiresInDays"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <Select
                                name={field.name}
                                selectedKey={field.value}
                                onSelectionChange={field.onChange}
                                onBlur={field.onBlur}
                                isDisabled={pending}
                                isInvalid={fieldState.invalid}
                                variant="secondary"
                                fullWidth
                              >
                                <Label>Expires in</Label>
                                <Select.Trigger ref={field.ref}>
                                  <Select.Value />
                                  <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                  <ListBox>
                                    {[7, 14, 30].map((days) => (
                                      <ListBox.Item key={days} id={days} textValue={`${days} days`}>
                                        {days} days
                                        <ListBox.ItemIndicator />
                                      </ListBox.Item>
                                    ))}
                                  </ListBox>
                                </Select.Popover>
                              </Select>
                              {fieldState.invalid ? (
                                <FieldError errors={[fieldState.error]} />
                              ) : null}
                            </Field>
                          )}
                        />
                      </div>
                      {count === 1 ? (
                        <Controller
                          control={form.control}
                          name="email"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor="invite-email">
                                Email address (optional)
                              </FieldLabel>
                              <Input
                                {...field}
                                id="invite-email"
                                type="email"
                                autoComplete="off"
                                spellCheck={false}
                                fullWidth
                                variant="secondary"
                                disabled={pending}
                                aria-invalid={fieldState.invalid}
                                aria-describedby="invite-email-help"
                              />
                              <p id="invite-email-help" className="text-muted text-xs">
                                Only this email can redeem the code. Leave empty to let anyone with
                                the code join.
                              </p>
                              {fieldState.invalid ? (
                                <FieldError errors={[fieldState.error]} />
                              ) : null}
                            </Field>
                          )}
                        />
                      ) : (
                        <p className="text-muted text-sm">
                          Batch codes are not bound to an email address.
                        </p>
                      )}
                    </FieldGroup>
                  </form>
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              {created ? (
                <Button fullWidth onPress={onClose}>
                  Done
                </Button>
              ) : (
                <Button fullWidth form="create-invites-form" type="submit" isDisabled={pending}>
                  {pending
                    ? "Creating…"
                    : count === 1
                      ? "Create invite code"
                      : "Create invite codes"}
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
