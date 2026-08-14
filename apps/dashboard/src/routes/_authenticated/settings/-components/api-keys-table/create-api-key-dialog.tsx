// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { fromDate, getLocalTimeZone, now } from "@internationalized/date";
import {
  CreateApiKeyRequest,
  type CreateApiKeyResponse,
  type ListSessionKeysForOrganizationResponse,
} from "@namera-ai/protocol/dto";
import {
  Alert,
  Button,
  Calendar,
  DateField,
  DatePicker,
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
import { Add01Icon, CheckmarkCircle02Icon, Copy01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { MetadataDisplay } from "@/components/display";
import { useCreateApiKey } from "@/hooks/api-key";
import { useSessionKeys } from "@/hooks/session-key";

type CreateApiKeyInput = typeof CreateApiKeyRequest.Encoded;
type CreateApiKeyOutput = typeof CreateApiKeyRequest.Type;

const timeZone = getLocalTimeZone();
const defaultValues: CreateApiKeyInput = {
  metadata: {
    version: 1,
    name: "",
    logo: { type: "emoji", value: "🔐" },
  },
  expiresAt: null,
  sessionKeyIds: [],
};

type CreateApiKeyDialogProps = {
  initialSessionKeys: ListSessionKeysForOrganizationResponse;
};

export function CreateApiKeyDialog({ initialSessionKeys }: CreateApiKeyDialogProps) {
  const createApiKey = useCreateApiKey();
  const sessionKeys = useSessionKeys();
  const [isOpen, setIsOpen] = useState(false);
  const [created, setCreated] = useState<CreateApiKeyResponse | null>(null);
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
  const handleSubmit = form.handleSubmit(async (payload) => {
    try {
      setCreated(await createApiKey.mutateAsync({ payload }));
    } catch {
      toast.danger("Couldn’t create the API key.");
    }
  });
  const copyKey = useEventCallback(async () => {
    if (created === null) return;
    try {
      await navigator.clipboard.writeText(created.key);
      toast.success("API key copied");
    } catch {
      toast.danger("Couldn’t copy the API key.");
    }
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
                  <Alert status="success">
                    <Alert.Indicator>
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                    </Alert.Indicator>
                    <Alert.Content className="min-w-0">
                      <Alert.Title>Copy this key now</Alert.Title>
                      <Alert.Description className="grid gap-3">
                        <span>
                          This is the only time the complete API key will be shown. It cannot be
                          recovered after you close this dialog.
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
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
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
                                    <div className="grid min-w-0 gap-1">
                                      <MetadataDisplay
                                        fallbackName="Unnamed session key"
                                        metadata={sessionKey.metadata}
                                      />
                                      <Typography className="truncate text-xs" color="muted">
                                        {sessionKey.wallet.metadata.name}
                                      </Typography>
                                    </div>
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
                      name="expiresAt"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <div className="grid gap-1">
                            <FieldLabel>Valid until</FieldLabel>
                            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                          </div>
                          <DatePicker
                            className="w-full"
                            granularity="minute"
                            isInvalid={fieldState.invalid}
                            minValue={now(timeZone)}
                            name={field.name}
                            value={field.value ? fromDate(field.value, timeZone) : null}
                            onBlur={field.onBlur}
                            onChange={(date) => field.onChange(date?.toDate() ?? null)}
                          >
                            <DateField.Group fullWidth variant="secondary">
                              <DateField.Input>
                                {(segment) => <DateField.Segment segment={segment} />}
                              </DateField.Input>
                              <DateField.Suffix>
                                <DatePicker.Trigger>
                                  <DatePicker.TriggerIndicator />
                                </DatePicker.Trigger>
                              </DateField.Suffix>
                            </DateField.Group>
                            <DatePicker.Popover>
                              <Calendar aria-label="Choose API key expiration">
                                <Calendar.Header>
                                  <Calendar.YearPickerTrigger>
                                    <Calendar.YearPickerTriggerHeading />
                                    <Calendar.YearPickerTriggerIndicator />
                                  </Calendar.YearPickerTrigger>
                                  <Calendar.NavButton slot="previous" />
                                  <Calendar.NavButton slot="next" />
                                </Calendar.Header>
                                <Calendar.Grid>
                                  <Calendar.GridHeader>
                                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                                  </Calendar.GridHeader>
                                  <Calendar.GridBody>
                                    {(date) => <Calendar.Cell date={date} />}
                                  </Calendar.GridBody>
                                </Calendar.Grid>
                                <Calendar.YearPickerGrid>
                                  <Calendar.YearPickerGridBody>
                                    {({ year }) => <Calendar.YearPickerCell year={year} />}
                                  </Calendar.YearPickerGridBody>
                                </Calendar.YearPickerGrid>
                              </Calendar>
                            </DatePicker.Popover>
                          </DatePicker>
                          <Typography className="text-xs" color="muted">
                            Optional. Leave empty for a key without a fixed expiration.
                          </Typography>
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
