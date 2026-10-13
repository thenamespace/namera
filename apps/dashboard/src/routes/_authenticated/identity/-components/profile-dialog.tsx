// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { WalletId } from "@namera-ai/protocol";
import type { IdentityDetail, IdentityRecordChange } from "@namera-ai/protocol/dto";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Modal,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { useUpdateIdentityRecords } from "@/hooks/identity";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { ProfileSchema, profileFields, profileValues, type ProfileValues } from "./profile-schema";

export function ProfileDialog({
  walletId,
  identity,
  onClose,
  onRefresh,
}: {
  walletId: WalletId;
  identity: IdentityDetail;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const id = useId();
  const form = useForm<ProfileValues>({
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(ProfileSchema)),
    defaultValues: profileValues(identity.texts),
  });
  const update = useUpdateIdentityRecords({
    onSuccess: () => {
      showSuccessToast({ title: "Profile saved" });
      onClose();
    },
    onError: (error) => {
      onRefresh();
      showErrorToast(error, { title: "Couldn’t save profile" });
    },
  });
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open && !update.isPending) onClose();
      }}
    >
      <Modal.Backdrop isDismissable={!update.isPending}>
        <Modal.Container>
          <Modal.Dialog className="w-full sm:max-w-xl">
            <Modal.CloseTrigger isDisabled={update.isPending} />
            <Modal.Header>
              <Modal.Heading>Edit profile</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Typography className="mb-4 text-sm text-muted">
                These public ENS records are separate from your account’s private metadata.
              </Typography>
              <form
                id={id}
                noValidate
                onSubmit={form.handleSubmit((values) => {
                  if (update.isPending) return;
                  const changes: IdentityRecordChange[] = profileFields
                    .filter(({ key, record }) => values[key] !== (identity.texts[record] ?? ""))
                    .map(({ key, record }) => ({
                      type: "text",
                      key: record,
                      value: values[key] || null,
                    }));
                  if (!changes.length) {
                    onClose();
                    return;
                  }
                  update.mutate({
                    params: { walletId, label: identity.label },
                    payload: { changes },
                  });
                })}
              >
                <FieldGroup>
                  {profileFields.map(({ key, label }) => (
                    <Controller
                      key={key}
                      name={key}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
                          <Input
                            {...field}
                            id={`${id}-${key}`}
                            variant="secondary"
                            disabled={update.isPending}
                            aria-invalid={fieldState.invalid}
                          />
                          <FieldError>{fieldState.error?.message}</FieldError>
                        </Field>
                      )}
                    />
                  ))}
                </FieldGroup>
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose} isDisabled={update.isPending}>
                Cancel
              </Button>
              <Button type="submit" form={id} isDisabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save profile"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
