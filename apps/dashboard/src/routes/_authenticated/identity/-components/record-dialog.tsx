// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { EnsLabel, WalletId } from "@namera-ai/protocol";
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
  TextArea,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { useIdentityNetworks, useUpdateIdentityRecords } from "@/hooks/identity";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const Key = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128));
const emptyNetworks: readonly { key: string; label: string; coinType: string }[] = [];
const Value = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4096));
const RecordSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal("text"), key: Key, value: Value }),
  Schema.Struct({ type: Schema.Literal("address"), key: Key, value: Value }),
  Schema.Struct({
    type: Schema.Literal("data"),
    key: Key,
    value: Schema.fromJsonString(Schema.Json),
  }),
]);
export type RecordDraft = {
  type: "text" | "address" | "data";
  key: string;
  value: string;
  existing: boolean;
};

export function RecordDialog({
  walletId,
  label,
  draft,
  onClose,
  onRefresh,
}: {
  walletId: WalletId;
  label: EnsLabel;
  draft: RecordDraft;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const id = useId();
  const networks = useIdentityNetworks();
  const form = useForm<typeof RecordSchema.Encoded, unknown, typeof RecordSchema.Type>({
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(RecordSchema)),
    defaultValues: { type: draft.type, key: draft.key, value: draft.value },
  });
  const update = useUpdateIdentityRecords({
    onSuccess: () => {
      showSuccessToast({ title: "Record saved" });
      onClose();
    },
    onError: (error) => {
      onRefresh();
      showErrorToast(error, { title: "Couldn’t save record" });
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
          <Modal.Dialog className="w-full sm:max-w-lg">
            <Modal.CloseTrigger isDisabled={update.isPending} />
            <Modal.Header>
              <Modal.Heading>
                {draft.existing ? "Edit" : "Add"} {draft.type === "data" ? "JSON data" : draft.type}{" "}
                record
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form
                id={id}
                noValidate
                onSubmit={form.handleSubmit((change) => {
                  if (!update.isPending)
                    update.mutate({ params: { walletId, label }, payload: { changes: [change] } });
                })}
              >
                <FieldGroup>
                  <Controller
                    name="key"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel id={`${id}-key-label`} htmlFor={`${id}-key`}>
                          {draft.type === "address" ? "Network" : "Key"}
                        </FieldLabel>
                        {draft.type === "address" ? (
                          <Select
                            aria-labelledby={`${id}-key-label`}
                            variant="secondary"
                            selectedKey={field.value || null}
                            isDisabled={update.isPending || draft.existing}
                            onBlur={field.onBlur}
                            onSelectionChange={field.onChange}
                          >
                            <Select.Trigger ref={field.ref}>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox items={networks.data ?? emptyNetworks}>
                                {(network) => (
                                  <ListBox.Item id={network.key} textValue={network.label}>
                                    {network.label}
                                  </ListBox.Item>
                                )}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        ) : (
                          <Input
                            {...field}
                            id={`${id}-key`}
                            variant="secondary"
                            disabled={update.isPending || draft.existing}
                            aria-invalid={fieldState.invalid}
                          />
                        )}
                        <FieldError>{fieldState.error?.message}</FieldError>
                      </Field>
                    )}
                  />
                  <Controller
                    name="value"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${id}-value`}>
                          {draft.type === "address" ? "Address" : "Value"}
                        </FieldLabel>
                        <TextArea
                          {...field}
                          id={`${id}-value`}
                          variant="secondary"
                          rows={draft.type === "data" ? 8 : 3}
                          maxLength={4096}
                          disabled={update.isPending}
                          aria-invalid={fieldState.invalid}
                          className="w-full"
                        />
                        <FieldError>{fieldState.error?.message}</FieldError>
                      </Field>
                    )}
                  />
                </FieldGroup>
              </form>
            </Modal.Body>
            <Modal.Footer>
              {draft.existing ? (
                <Button
                  variant="danger-soft"
                  isDisabled={update.isPending}
                  onPress={() =>
                    update.mutate({
                      params: { walletId, label },
                      payload: { changes: [{ type: draft.type, key: draft.key, value: null }] },
                    })
                  }
                >
                  Remove record
                </Button>
              ) : null}
              <Button variant="tertiary" onPress={onClose} isDisabled={update.isPending}>
                Cancel
              </Button>
              <Button type="submit" form={id} isDisabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save record"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
