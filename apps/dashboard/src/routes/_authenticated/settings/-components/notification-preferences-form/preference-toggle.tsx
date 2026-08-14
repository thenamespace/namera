// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { Field, FieldLabel, Switch, Typography } from "@namera-ai/ui";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";

import { DashboardCardRow } from "@/components/dashboard-card";

import type { NotificationPreferenceItem } from "./data";
import type { NotificationPreferencesFormInput, NotificationPreferencesFormValues } from "./index";

export function NotificationPreferenceToggle({
  control,
  description,
  index,
  label,
}: Pick<NotificationPreferenceItem, "description" | "label"> & {
  control: Control<NotificationPreferencesFormInput, unknown, NotificationPreferencesFormValues>;
  index: number;
}) {
  return (
    <Controller
      control={control}
      name={`preferences.${index}.enabled`}
      render={({ field, fieldState }) => {
        const labelId = `notification-preference-${index}-label`;

        return (
          <DashboardCardRow className="grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto]!">
            <Field className="contents" data-invalid={fieldState.invalid}>
              <div className="min-w-0">
                <FieldLabel id={labelId}>{label}</FieldLabel>
                <Typography className="mt-0.5 text-xs leading-tight" color="muted">
                  {description}
                </Typography>
              </div>
              <Switch
                aria-labelledby={labelId}
                isSelected={field.value}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                ref={field.ref}
                size="md"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </Field>
          </DashboardCardRow>
        );
      }}
    />
  );
}
