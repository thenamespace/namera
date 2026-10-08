import { Predicate, Schema } from "effect";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreatePlatformInvitationRequest } from "@namera-ai/protocol/dto";
import type { PlatformMemberView } from "@namera-ai/protocol/model";
import {
  Button,
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  Input,
  ListBox,
  Modal,
  Select,
  Typography,
  toast,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { useInviteMember, useChangeMemberRole, useRemoveMember } from "@/hooks/team";
import { showTeamError } from "@/lib/team-feedback";

const roles = [
  { id: "operator", label: "Operator" },
  { id: "viewer", label: "Viewer" },
];

export type MemberDialogState =
  | { type: "invite" }
  | { type: "role" | "remove"; member: typeof PlatformMemberView.Type };

export function MemberDialog({
  state,
  onClose,
}: {
  state: MemberDialogState;
  onClose: () => void;
}) {
  const success = (title: string) => {
    toast.success(title);
    onClose();
  };
  const invite = useInviteMember({
    onError: showTeamError,
    onSuccess: () => success("Invitation sent"),
  });
  const update = useChangeMemberRole({
    onError: showTeamError,
    onSuccess: () => success("Member role updated"),
  });
  const remove = useRemoveMember({
    onError: showTeamError,
    onSuccess: () => success("Member removed"),
  });
  const pending = invite.isPending || update.isPending || remove.isPending;
  const error =
    state.type === "invite" ? invite.error : state.type === "role" ? update.error : remove.error;
  const needsSignIn =
    Predicate.isTagged(error, "Unauthorized") ||
    (Predicate.isTagged(error, "PlatformAuthError") &&
      "code" in error &&
      error.code === "RECENT_LOGIN_REQUIRED");
  const isInvite = state.type === "invite";
  const form = useForm<
    typeof CreatePlatformInvitationRequest.Encoded,
    unknown,
    typeof CreatePlatformInvitationRequest.Type
  >({
    defaultValues: {
      email: isInvite ? "" : state.member.email,
      role: !isInvite && state.member.role === "operator" ? "operator" : "viewer",
    },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreatePlatformInvitationRequest)),
  });
  const title = isInvite
    ? "Invite member"
    : state.type === "role"
      ? "Update role"
      : "Remove member";
  const submit = form.handleSubmit((payload) => {
    if (state.type === "invite") {
      invite.mutate({ payload });
    } else if (state.type === "role") {
      update.mutate({
        params: { id: state.member.id },
        payload: { role: payload.role },
      });
    }
  });
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size={isInvite ? "lg" : "sm"}>
          <Modal.Dialog>
            <form id="admin-member-form" noValidate onSubmit={submit}>
              <Modal.CloseTrigger isDisabled={pending} />
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="grid gap-5">
                {needsSignIn ? (
                  <a href="/auth?reauth=true" className="text-accent text-sm underline">
                    Sign in again to continue
                  </a>
                ) : null}
                <Typography color="muted" className="text-sm">
                  {isInvite
                    ? "Send an email invitation to join the Namera admin team. Invitations expire after seven days."
                    : state.type === "role"
                      ? `Choose a new role for ${state.member.email}.`
                      : `Remove ${state.member.email} from the admin team? Their admin access will be revoked immediately. Their Namera account will not be deleted.`}
                </Typography>
                {state.type !== "remove" ? (
                  <FieldGroup>
                    {isInvite ? (
                      <Controller
                        control={form.control}
                        name="email"
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="member-email">Email address</FieldLabel>
                            <Input
                              {...field}
                              id="member-email"
                              type="email"
                              autoComplete="email"
                              inputMode="email"
                              spellCheck={false}
                              fullWidth
                              variant="secondary"
                              disabled={pending}
                              aria-invalid={fieldState.invalid}
                              placeholder="name@company.com"
                            />
                            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                          </Field>
                        )}
                      />
                    ) : null}
                    <Controller
                      control={form.control}
                      name="role"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel id="member-role-label">Role</FieldLabel>
                          <Select
                            aria-labelledby="member-role-label"
                            fullWidth
                            isRequired
                            isDisabled={pending}
                            isInvalid={fieldState.invalid}
                            name={field.name}
                            selectedKey={field.value}
                            onSelectionChange={field.onChange}
                            variant="secondary"
                          >
                            <Select.Trigger ref={field.ref} onBlur={field.onBlur}>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox items={roles}>
                                {(role) => (
                                  <ListBox.Item id={role.id} textValue={role.label}>
                                    {role.label}
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
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                {state.type === "remove" ? (
                  <Button
                    fullWidth
                    variant="danger"
                    isDisabled={pending}
                    onPress={() => remove.mutate({ params: { id: state.member.id } })}
                  >
                    {pending ? "Removing…" : "Remove member"}
                  </Button>
                ) : (
                  <Button fullWidth form="admin-member-form" type="submit" isDisabled={pending}>
                    {pending
                      ? isInvite
                        ? "Sending…"
                        : "Updating…"
                      : isInvite
                        ? "Send invite"
                        : "Update role"}
                  </Button>
                )}
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
