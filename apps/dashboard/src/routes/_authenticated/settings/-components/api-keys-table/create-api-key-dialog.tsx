// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useEffect, useMemo, useRef, useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  CreateApiKeyRequest,
  type CreateApiKeyResponse,
  type ListSessionKeysForOrganizationResponse,
} from "@namera-ai/protocol/dto";
import type { ApiKeyPermission } from "@namera-ai/protocol/model";
import {
  Button,
  Checkbox,
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

import { SessionKeySelect } from "@/components/session-key-select";
import { useCreateApiKey } from "@/hooks/api-key";
import { useCurrentUser } from "@/hooks/auth";
import { useSessionKeys } from "@/hooks/session-key";
import { copyTextWithFeedback, writeClipboardText } from "@/lib/clipboard";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { PasskeyOriginsField } from "./passkey-origins-field.js";

type CreateApiKeyInput = typeof CreateApiKeyRequest.Encoded;
type CreateApiKeyOutput = typeof CreateApiKeyRequest.Type;

const durationOptions = [
  { id: "7", name: "7 days" },
  { id: "30", name: "30 days" },
  { id: "90", name: "90 days" },
] as const;

const managementOptions = [
  { label: "Create accounts", permissions: ["wallet:read", "wallet:create"] },
  {
    label: "Create session keys",
    permissions: ["wallet:read", "session-key:read", "session-key:create"],
  },
  {
    label: "Manage session key installations",
    permissions: [
      "wallet:read",
      "session-key:read",
      "session-key:install",
      "session-key:uninstall",
      "session-key:revoke",
    ],
  },
] as const satisfies readonly {
  label: string;
  permissions: readonly (typeof ApiKeyPermission.Type)[];
}[];

const defaultValues: CreateApiKeyInput = {
  metadata: {
    version: 1,
    name: "",
    logo: { type: "emoji", value: "🔐" },
  },
  durationDays: 30,
  sessionKeyIds: [],
  permissions: [],
  passkeyOrigins: [],
};

type CreateApiKeyDialogProps = {
  initialSessionKeys: ListSessionKeysForOrganizationResponse;
};

export function CreateApiKeyDialog({ initialSessionKeys }: CreateApiKeyDialogProps) {
  const sessionKeys = useSessionKeys();
  const currentUser = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [created, setCreated] = useState<CreateApiKeyResponse | null>(null);
  const pendingPayload = useRef<CreateApiKeyOutput | undefined>(undefined);
  useEffect(
    () => () => {
      pendingPayload.current = undefined;
    },
    [],
  );
  const createApiKey = useCreateApiKey({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t create API key",
        description: "Review its session-key access and try again.",
      }),
    onSuccess: (key, { payload }) => {
      if (pendingPayload.current !== payload) return;
      pendingPayload.current = undefined;
      setCreated(key);
      void writeClipboardText(key.key).then((copied) =>
        copied
          ? showSuccessToast({
              title: "API key created and copied",
              description: "Store it now. It won’t be shown again.",
            })
          : showSuccessToast({
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
    if (!open && createApiKey.isPending) return;
    setIsOpen(open);
    if (!open) {
      pendingPayload.current = undefined;
      form.reset(defaultValues);
      setCreated(null);
      createApiKey.reset();
    }
  });
  const createKey = useEventCallback((payload: CreateApiKeyOutput) => {
    pendingPayload.current = payload;
    createApiKey.mutate({ payload });
  });
  const handleSubmit = form.handleSubmit(createKey);
  const copyKey = useEventCallback(() => {
    if (created === null) return;

    void copyTextWithFeedback(created.key, {
      success: {
        title: "API key copied",
        description: "Store it somewhere secure before closing this dialog.",
      },
      error: {
        title: "Couldn’t copy API key",
        description: "Copy it manually before closing this dialog.",
      },
    });
  });

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button className="self-start sm:self-auto" size="sm" type="button">
        <HugeiconsIcon icon={Add01Icon} />
        Create API key
      </Button>

      <Modal.Backdrop
        isDismissable={!createApiKey.isPending}
        isKeyboardDismissDisabled={createApiKey.isPending}
      >
        <Modal.Container size="lg">
          <Modal.Dialog>
            {!createApiKey.isPending ? <Modal.CloseTrigger /> : null}
            <Modal.Header>
              <Modal.Heading>{created ? "API key created" : "Create API key"}</Modal.Heading>
              {!created ? (
                <Typography className="text-sm" color="muted">
                  Select session keys for execution access, or grant workspace management
                  permissions.
                </Typography>
              ) : null}
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
                <Modal.Body className="grid max-h-[55dvh] gap-5 overflow-y-auto">
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
                            <FieldLabel id="api-key-session-keys-label">
                              Accounts and session keys
                            </FieldLabel>
                            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                          </div>
                          <SessionKeySelect
                            aria-labelledby="api-key-session-keys-label"
                            isInvalid={fieldState.invalid}
                            name={field.name}
                            sessionKeys={availableSessionKeys}
                            triggerRef={field.ref}
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                          />
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
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium">Advanced</summary>
                      <div className="grid gap-5 pt-4">
                        <Controller
                          control={form.control}
                          name="permissions"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel id="api-key-permissions-label">
                                Workspace management permissions
                              </FieldLabel>
                              <Typography className="text-sm" color="muted">
                                Covers all workspace accounts and can grant full control of managed
                                accounts.
                              </Typography>
                              <fieldset
                                aria-labelledby="api-key-permissions-label"
                                className="grid gap-2"
                              >
                                {managementOptions.map((option) => {
                                  const selected = option.permissions.every((permission) =>
                                    field.value?.includes(permission),
                                  );
                                  const canDelegate = option.permissions.every((permission) => {
                                    const memberPermission =
                                      permission === "session-key:install"
                                        ? "session-key:create"
                                        : permission === "session-key:uninstall"
                                          ? "session-key:revoke"
                                          : permission;
                                    return currentUser.data?.role.permissions.includes(
                                      memberPermission,
                                    );
                                  });
                                  return (
                                    <Checkbox
                                      key={option.label}
                                      isSelected={selected}
                                      isDisabled={!canDelegate}
                                      onBlur={field.onBlur}
                                      onChange={(checked) => {
                                        const selectedOptions = managementOptions.filter(
                                          (candidate) =>
                                            candidate === option
                                              ? checked
                                              : candidate.permissions.every((permission) =>
                                                  field.value?.includes(permission),
                                                ),
                                        );
                                        field.onChange([
                                          ...new Set(
                                            selectedOptions.flatMap(
                                              (candidate) => candidate.permissions,
                                            ),
                                          ),
                                        ]);
                                      }}
                                    >
                                      <Checkbox.Content>
                                        <Checkbox.Control>
                                          <Checkbox.Indicator />
                                        </Checkbox.Control>
                                        {option.label}
                                      </Checkbox.Content>
                                    </Checkbox>
                                  );
                                })}
                              </fieldset>
                              {fieldState.invalid ? (
                                <FieldError errors={[fieldState.error]} />
                              ) : null}
                            </Field>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name="passkeyOrigins"
                          render={({ field, fieldState }) => (
                            <PasskeyOriginsField
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              inputRef={field.ref}
                              error={fieldState.error}
                            />
                          )}
                        />
                      </div>
                    </details>
                  </FieldGroup>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    form="create-api-key-form"
                    fullWidth
                    isDisabled={createApiKey.isPending}
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
