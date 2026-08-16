// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  CreateApiKeyRequest,
  type CreateApiKeyResponse,
  type ListSessionKeysForOrganizationResponse,
} from "@namera-ai/protocol/dto";
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
} from "@namera-ai/ui";
import { Add01Icon, Copy01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { MetadataDisplay } from "@/components/display";
import { useCreateApiKey } from "@/hooks/api-key";
import { useSessionKeys } from "@/hooks/session-key";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

type CreateApiKeyInput = typeof CreateApiKeyRequest.Encoded;
type CreateApiKeyOutput = typeof CreateApiKeyRequest.Type;

const durationOptions = [
  { id: "7", name: "7 days" },
  { id: "30", name: "30 days" },
  { id: "90", name: "90 days" },
] as const;

const defaultValues: CreateApiKeyInput = {
  metadata: {
    version: 1,
    name: "",
    logo: { type: "emoji", value: "🔐" },
  },
  durationDays: 30,
  sessionKeyIds: [],
};

type CreateApiKeyDialogProps = {
  initialSessionKeys: ListSessionKeysForOrganizationResponse;
};

export function CreateApiKeyDialog({ initialSessionKeys }: CreateApiKeyDialogProps) {
  const sessionKeys = useSessionKeys();
  const [isOpen, setIsOpen] = useState(false);
  const [created, setCreated] = useState<CreateApiKeyResponse | null>(null);
  const createApiKey = useCreateApiKey({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t create API key",
        description: "Review its session-key access and try again.",
      }),
    onSuccess: (key) => {
      setCreated(key);
      void navigator.clipboard.writeText(key.key).then(
        () =>
          showSuccessToast({
            title: "API key created and copied",
            description: "Store it now. It won’t be shown again.",
          }),
        () =>
          showSuccessToast({
            title: "API key created",
            description: "Copy and store it now. It won’t be shown again.",
          }),
      );
    },
  });
  const availableSessionKeys = useMemo(
    () => (sessionKeys.data ?? initialSessionKeys).filter(({ status }) => status === "active"),
    [initialSessionKeys, sessionKeys.data],
  );
  const form = useForm<CreateApiKeyInput, unknown, CreateApiKeyOutput>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateApiKeyRequest)),
  });

  const handleOpenChange = useEventCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      form.reset(defaultValues);
      setCreated(null);
      createApiKey.reset();
    }
  });
  const handleSubmit = form.handleSubmit((payload) => {
    createApiKey.mutate({ payload });
  });
  const copyKey = useEventCallback(() => {
    if (created === null) return;

    void navigator.clipboard.writeText(created.key).then(
      () =>
        showSuccessToast({
          title: "API key copied",
          description: "Store it somewhere secure before closing this dialog.",
        }),
      () =>
        showErrorToast(undefined, {
          title: "Couldn’t copy API key",
          description: "Copy it manually before closing this dialog.",
        }),
    );
  });

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button className="self-start sm:self-auto" size="sm" type="button">
        <HugeiconsIcon icon={Add01Icon} />
        Create API key
      </Button>

      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{created ? "API key created" : "Create API key"}</Modal.Heading>
            </Modal.Header>

            {created ? (
              <>
                <Modal.Body className="grid gap-5">
                  <span>
                    The API Key can now be used to access Namera SDK. You will not be able to see
                    this key again once you close this dialog.
                  </span>
                  <span className="bg-success-soft text-success-soft-foreground flex min-w-0 items-center gap-2 rounded-lg px-3 py-2">
                    <code className="min-w-0 flex-1 truncate text-xs">{created.key}</code>
                    <Button
                      aria-label="Copy API key"
                      isIconOnly
                      size="sm"
                      type="button"
                      variant="ghost"
                      onPress={copyKey}
                    >
                      <HugeiconsIcon icon={Copy01Icon} />
                    </Button>
                  </span>
                </Modal.Body>
                <Modal.Footer>
                  <Button fullWidth type="button" onPress={() => handleOpenChange(false)}>
                    Done
                  </Button>
                </Modal.Footer>
              </>
            ) : (
              <form id="create-api-key-form" noValidate onSubmit={handleSubmit}>
                <Modal.Body className="grid gap-5">
                  <Typography color="muted">
                    Grant an API key access to one or more active session keys.
                  </Typography>
                  <FieldGroup>
                    <Controller
                      control={form.control}
                      name="metadata.name"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <div className="grid gap-1">
                            <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
                            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                          </div>
                          <Input
                            {...field}
                            id="api-key-name"
                            aria-invalid={fieldState.invalid}
                            autoComplete="off"
                            fullWidth
                            placeholder="Production agent"
                            variant="secondary"
                          />
                        </Field>
                      )}
                    />

                    <Controller
                      control={form.control}
                      name="sessionKeyIds"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <div className="grid gap-1">
                            <FieldLabel id="api-key-session-keys-label">Session keys</FieldLabel>
                            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                          </div>
                          <Select<(typeof availableSessionKeys)[number], "multiple">
                            aria-labelledby="api-key-session-keys-label"
                            fullWidth
                            isInvalid={fieldState.invalid}
                            name={field.name}
                            selectionMode="multiple"
                            variant="secondary"
                            value={field.value}
                            onChange={field.onChange}
                          >
                            <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                              <Select.Value>
                                {field.value.length === 0
                                  ? "Select session keys"
                                  : `${field.value.length} session key${field.value.length === 1 ? "" : "s"} selected`}
                              </Select.Value>
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox items={availableSessionKeys}>
                                {(sessionKey) => (
                                  <ListBox.Item
                                    id={sessionKey.id}
                                    textValue={sessionKey.metadata.name}
                                  >
                                    <MetadataDisplay
                                      fallbackName="Unnamed session key"
                                      metadata={sessionKey.metadata}
                                    />
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                )}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        </Field>
                      )}
                    />

                    <Controller
                      control={form.control}
                      name="durationDays"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <div className="grid gap-1">
                            <FieldLabel id="api-key-duration-label">Duration</FieldLabel>
                            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                          </div>
                          <Select
                            aria-labelledby="api-key-duration-label"
                            fullWidth
                            isInvalid={fieldState.invalid}
                            isRequired
                            name={field.name}
                            selectedKey={String(field.value)}
                            variant="secondary"
                            onSelectionChange={(value) => field.onChange(Number(value))}
                          >
                            <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox items={durationOptions}>
                                {(option) => (
                                  <ListBox.Item id={option.id} textValue={option.name}>
                                    {option.name}
                                  </ListBox.Item>
                                )}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        </Field>
                      )}
                    />
                  </FieldGroup>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    form="create-api-key-form"
                    fullWidth
                    isDisabled={createApiKey.isPending || availableSessionKeys.length === 0}
                    type="submit"
                  >
                    {createApiKey.isPending ? "Creating…" : "Create API key"}
                  </Button>
                </Modal.Footer>
              </form>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
