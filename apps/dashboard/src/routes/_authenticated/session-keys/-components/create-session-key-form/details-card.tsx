// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  IconPicker,
  Input,
  ListBox,
  Select,
  TextArea,
} from "@namera-ai/ui";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { MetadataDisplay } from "@/components/display";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "🔑" };

type SessionKeyDetailsCardProps = {
  control: Control<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  wallets: ListWalletsResponse;
};

export function SessionKeyDetailsCard({ control, wallets }: SessionKeyDetailsCardProps) {
  const activeWallets = wallets.filter(
    (wallet) =>
      wallet.status === "active" &&
      wallet.owner.custody === "local" &&
      wallet.owner.algorithm === "p256",
  );

  return (
    <DashboardCardRoot>
      <DashboardCardContent>
        <FieldGroup className="divide-separator contents divide-y">
          <Controller
            control={control}
            name="metadata.logo"
            render={({ field, fieldState }) => (
              <DashboardCardRow className="grid-cols-[minmax(0,1fr)_auto]">
                <Field className="contents" data-invalid={fieldState.invalid}>
                  <FieldLabel>Session key logo</FieldLabel>
                  <IconPicker
                    aria-label="Choose session key logo"
                    setValue={field.onChange}
                    size="md"
                    supportedTypes={supportedLogoTypes}
                    triggerClassName="justify-self-end"
                    value={field.value ?? defaultLogo}
                  />
                </Field>
              </DashboardCardRow>
            )}
          />

          <Controller
            control={control}
            name="metadata.name"
            render={({ field, fieldState }) => (
              <DashboardCardRow className="items-start sm:items-start">
                <Field className="contents" data-invalid={fieldState.invalid}>
                  <div className="grid min-w-0 gap-1">
                    <FieldLabel htmlFor="session-key-name" isRequired>
                      Name
                    </FieldLabel>
                    <div className="min-h-5" id="session-key-name-error">
                      {fieldState.invalid ? (
                        <FieldError>
                          {field.value?.trim()
                            ? "Use a name of 255 characters or fewer."
                            : "Enter a name for this session key."}
                        </FieldError>
                      ) : null}
                    </div>
                  </div>
                  <Input
                    {...field}
                    id="session-key-name"
                    aria-describedby={fieldState.error ? "session-key-name-error" : undefined}
                    required
                    aria-invalid={fieldState.invalid}
                    autoComplete="off"
                    fullWidth
                    placeholder="Enter session key name"
                    variant="secondary"
                  />
                </Field>
              </DashboardCardRow>
            )}
          />

          <Controller
            control={control}
            name="metadata.description"
            render={({ field, fieldState }) => (
              <DashboardCardRow className="items-start sm:items-start">
                <Field className="contents" data-invalid={fieldState.invalid}>
                  <div className="grid min-w-0 gap-1">
                    <FieldLabel htmlFor="session-key-description">Description</FieldLabel>
                    <div className="min-h-5" id="session-key-description-error">
                      {fieldState.invalid ? (
                        <FieldError>Keep the description to 1,024 characters or fewer.</FieldError>
                      ) : null}
                    </div>
                  </div>
                  <TextArea
                    {...field}
                    id="session-key-description"
                    aria-describedby={
                      fieldState.error ? "session-key-description-error" : undefined
                    }
                    aria-invalid={fieldState.invalid}
                    autoComplete="off"
                    fullWidth
                    placeholder="Describe how this key will be used"
                    rows={3}
                    variant="secondary"
                  />
                </Field>
              </DashboardCardRow>
            )}
          />

          <Controller
            control={control}
            name="walletId"
            render={({ field, fieldState }) => {
              const selectedWallet = activeWallets.find((wallet) => wallet.id === field.value);

              return (
                <DashboardCardRow className="items-start sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid min-w-0 gap-1">
                      <FieldLabel id="session-key-wallet-label" isRequired>
                        Account
                      </FieldLabel>
                      <div className="min-h-5" id="session-key-wallet-error">
                        {fieldState.invalid ? (
                          <FieldError>Choose an account for this session key.</FieldError>
                        ) : null}
                      </div>
                    </div>
                    <Select
                      aria-labelledby="session-key-wallet-label"
                      aria-describedby={fieldState.error ? "session-key-wallet-error" : undefined}
                      fullWidth
                      isDisabled={activeWallets.length === 0}
                      isInvalid={fieldState.invalid}
                      isRequired
                      name={field.name}
                      onSelectionChange={field.onChange}
                      selectedKey={field.value ?? null}
                      variant="secondary"
                    >
                      <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                        <Select.Value>
                          {selectedWallet ? (
                            <MetadataDisplay
                              fallbackName="Unnamed account"
                              metadata={selectedWallet.metadata}
                            />
                          ) : (
                            <span className="text-muted">
                              {activeWallets.length === 0
                                ? "No active passkey accounts"
                                : "Select an account"}
                            </span>
                          )}
                        </Select.Value>
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox items={activeWallets}>
                          {(wallet) => (
                            <ListBox.Item
                              id={wallet.id}
                              textValue={wallet.metadata.name || "Unnamed account"}
                            >
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                                <MetadataDisplay
                                  fallbackName="Unnamed account"
                                  metadata={wallet.metadata}
                                />
                                <span className="text-muted shrink-0 font-mono text-xs">
                                  {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                                </span>
                              </div>
                            </ListBox.Item>
                          )}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Field>
                </DashboardCardRow>
              );
            }}
          />
        </FieldGroup>
      </DashboardCardContent>
    </DashboardCardRoot>
  );
}
