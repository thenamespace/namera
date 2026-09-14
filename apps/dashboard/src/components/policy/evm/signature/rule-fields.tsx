// oxlint-disable react-perf/jsx-no-new-function-as-prop
import {
  Button,
  Checkbox,
  Field,
  FieldError,
  FieldLabel,
  Input,
  ListBox,
  Select,
} from "@namera-ai/ui";
import { Delete02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, type Control } from "react-hook-form";

import { evmChainOptions } from "../data";
import type { SignatureFormInput, SignaturePolicyForm } from "./form";

const textFields = [
  { key: "verifyingContract", label: "Verifying contract", placeholder: "0x…" },
  { key: "primaryTypes", label: "Message types", placeholder: "Permit, Authorization" },
] as const;

export function SignatureRuleFields({
  control,
  index,
  onRemove,
}: {
  control: Control<SignatureFormInput, unknown, typeof SignaturePolicyForm.Type>;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div className="border-separator bg-surface/40 grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted text-xs">Rule {index + 1}</span>
        <Button
          isIconOnly
          aria-label={`Remove typed-data rule ${index + 1}`}
          size="sm"
          type="button"
          variant="tertiary"
          onPress={onRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} />
        </Button>
      </div>
      <Controller
        control={control}
        name={`rules.${index}.chainId`}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id={`typed-data-network-${index}`}>Network</FieldLabel>
            <Select
              aria-labelledby={`typed-data-network-${index}`}
              fullWidth
              isInvalid={fieldState.invalid}
              name={field.name}
              selectedKey={field.value}
              variant="secondary"
              onSelectionChange={field.onChange}
            >
              <Select.Trigger ref={field.ref} onBlur={field.onBlur}>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox items={evmChainOptions}>
                  {(chain) => (
                    <ListBox.Item id={chain.id} textValue={chain.name}>
                      {chain.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  )}
                </ListBox>
              </Select.Popover>
            </Select>
            {fieldState.error ? <FieldError>{fieldState.error.message}</FieldError> : null}
          </Field>
        )}
      />
      {textFields.map(({ key, label, placeholder }) => (
        <Controller
          key={key}
          control={control}
          name={`rules.${index}.${key}`}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`typed-data-${index}-${key}`}>{label}</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                id={`typed-data-${index}-${key}`}
                placeholder={placeholder}
                variant="secondary"
              />
              {fieldState.error ? <FieldError>{fieldState.error.message}</FieldError> : null}
            </Field>
          )}
        />
      ))}
      {(
        [
          { key: "name", match: "matchName", label: "Match domain name exactly" },
          { key: "version", match: "matchVersion", label: "Match domain version exactly" },
        ] as const
      ).map(({ key, match, label }) => (
        <Controller
          key={key}
          control={control}
          name={`rules.${index}.${match}`}
          render={({ field: matching }) => (
            <Field>
              <Checkbox
                name={matching.name}
                isSelected={matching.value}
                onChange={matching.onChange}
                onBlur={matching.onBlur}
              >
                <Checkbox.Content>
                  <Checkbox.Control ref={matching.ref}>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {label}
                </Checkbox.Content>
              </Checkbox>
              {matching.value ? (
                <Controller
                  control={control}
                  name={`rules.${index}.${key}`}
                  render={({ field }) => (
                    <Input
                      {...field}
                      aria-label={key === "name" ? "Exact domain name" : "Exact domain version"}
                      autoComplete="off"
                      placeholder="Empty string"
                      variant="secondary"
                    />
                  )}
                />
              ) : null}
            </Field>
          )}
        />
      ))}
    </div>
  );
}
