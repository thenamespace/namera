// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateIdentityRequest, type WalletResponse } from "@namera-ai/protocol/dto";
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

import { MetadataDisplay } from "@/components/display";
import { useEnsNameAvailability } from "@/hooks/ens";
import { useCreateIdentity } from "@/hooks/identity";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

export function CreateIdentityDialog({
  account,
  onClose,
}: {
  account: Pick<WalletResponse, "id" | "metadata" | "address">;
  onClose: () => void;
}) {
  const id = useId();
  const navigate = useNavigate();
  const [availability, setAvailability] = useState<{ name: string; available: boolean }>();
  const form = useForm<
    typeof CreateIdentityRequest.Encoded,
    unknown,
    typeof CreateIdentityRequest.Type
  >({
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateIdentityRequest)),
    defaultValues: { label: "" },
  });
  const check = useEnsNameAvailability({
    onSuccess: (result) => setAvailability(result),
    onError: (error) => showErrorToast(error, { title: "Couldn’t check name" }),
  });
  const create = useCreateIdentity({
    onSuccess: (identity) => {
      showSuccessToast({ title: "Identity created" });
      void navigate({
        to: "/identity/$accountId/$label",
        params: { accountId: account.id, label: identity.label },
      });
      onClose();
    },
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t create identity",
        description: "Check your identities before retrying.",
      }),
  });
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open && !create.isPending) onClose();
      }}
    >
      <Modal.Backdrop isDismissable={!create.isPending}>
        <Modal.Container>
          <Modal.Dialog className="w-full sm:max-w-lg">
            <Modal.CloseTrigger isDisabled={create.isPending} />
            <Modal.Header>
              <Modal.Heading>Create identity</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form
                id={id}
                noValidate
                onSubmit={form.handleSubmit((payload) => {
                  if (!create.isPending)
                    create.mutate({ params: { walletId: account.id }, payload });
                })}
              >
                <FieldGroup>
                  <Controller
                    name="label"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${id}-label`} isRequired>
                          Name
                        </FieldLabel>
                        <div className="flex items-center gap-2">
                          <Input
                            {...field}
                            id={`${id}-label`}
                            variant="secondary"
                            placeholder="treasury"
                            autoComplete="off"
                            disabled={create.isPending}
                            aria-invalid={fieldState.invalid}
                            className="min-w-0 flex-1"
                          />
                          <Typography className="text-muted">.namera.id</Typography>
                        </div>
                        <FieldError>{fieldState.error?.message}</FieldError>
                      </Field>
                    )}
                  />
                  <Button
                    variant="tertiary"
                    isDisabled={check.isPending || create.isPending}
                    onPress={() => void form.handleSubmit((query) => check.mutate({ query }))()}
                  >
                    Check availability
                  </Button>
                  {availability ? (
                    <output className="text-sm">
                      {availability.name} is {availability.available ? "available" : "unavailable"}.
                    </output>
                  ) : null}
                  <div className="grid gap-2">
                    <Typography className="text-sm text-muted">Account</Typography>
                    <MetadataDisplay metadata={account.metadata} fallbackName="Account" />
                    <Typography className="break-all text-xs text-muted">
                      {account.address}
                    </Typography>
                  </div>
                  <Typography className="text-sm text-muted">
                    This name and its records are public. Creating it does not set your Ethereum
                    primary name.
                  </Typography>
                </FieldGroup>
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose} isDisabled={create.isPending}>
                Cancel
              </Button>
              <Button type="submit" form={id} isDisabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create identity"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
