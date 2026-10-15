// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop
import { useId, useRef, useState, type Ref } from "react";

import { Button, Field, FieldError, FieldLabel, Input, Tooltip } from "@namera-ai/ui";
import { Add01Icon, Cancel01Icon, HugeiconsIcon, InformationCircleIcon } from "@namera-ai/ui/icons";
import type { FieldError as FormFieldError } from "react-hook-form";

type PasskeyOriginsFieldProps = {
  readonly value: readonly string[] | undefined;
  readonly onChange: (origins: string[]) => void;
  readonly onBlur: () => void;
  readonly inputRef: Ref<HTMLInputElement>;
  readonly error: FormFieldError | undefined;
};

export function PasskeyOriginsField({
  value,
  onChange,
  onBlur,
  inputRef,
  error,
}: PasskeyOriginsFieldProps) {
  const fieldId = useId();
  const nextId = useRef(value?.length || 1);
  const [origins, setOrigins] = useState(() =>
    (value?.length ? value : [""]).map((origin, index) => ({ id: index, value: origin })),
  );

  const updateOrigins = (updated: typeof origins) => {
    setOrigins(updated);
    onChange(updated.map((origin) => origin.value.trim()).filter(Boolean));
  };

  return (
    <Field data-invalid={Boolean(error)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <FieldLabel htmlFor={`${fieldId}-${origins[0]?.id}`}>
            Passkey application origins
          </FieldLabel>
          <Tooltip delay={200}>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label="About passkey application origins"
                size="sm"
                variant="tertiary"
                className="size-6 min-h-0 min-w-0 p-0 text-muted"
                type="button"
              >
                <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-64" showArrow>
              <Tooltip.Arrow />
              Optional. Add exact HTTPS origins for SDK passkey registration. HTTP localhost is
              allowed for development.
            </Tooltip.Content>
          </Tooltip>
        </div>
        <Button
          aria-label="Add passkey origin"
          size="sm"
          variant="tertiary"
          type="button"
          onPress={() => setOrigins([...origins, { id: nextId.current++, value: "" }])}
        >
          <HugeiconsIcon icon={Add01Icon} />
          Add
        </Button>
      </div>
      <div className="grid gap-2">
        {origins.map((origin, index) => (
          <div key={origin.id} className="flex items-center gap-2">
            <Input
              id={`${fieldId}-${origin.id}`}
              aria-label={
                index === 0
                  ? "Passkey application origins"
                  : `Passkey application origin ${index + 1}`
              }
              aria-invalid={Boolean(error)}
              ref={index === 0 ? inputRef : undefined}
              fullWidth
              variant="secondary"
              placeholder="https://app.example.com"
              value={origin.value}
              onBlur={onBlur}
              onChange={(event) =>
                updateOrigins(
                  origins.map((candidate) =>
                    candidate.id === origin.id
                      ? { ...candidate, value: event.target.value }
                      : candidate,
                  ),
                )
              }
            />
            {origins.length > 1 ? (
              <Button
                isIconOnly
                aria-label={`Remove passkey origin ${index + 1}`}
                size="sm"
                variant="tertiary"
                type="button"
                onPress={() =>
                  updateOrigins(origins.filter((candidate) => candidate.id !== origin.id))
                }
              >
                <HugeiconsIcon icon={Cancel01Icon} />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <FieldError errors={[error]} /> : null}
    </Field>
  );
}
