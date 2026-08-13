import { Switch, Typography } from "@namera-ai/ui";
import { useController } from "react-hook-form";
import type { Control } from "react-hook-form";

import { DashboardCard } from "@/components/dashboard-card";

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
  const enabled = useController({
    control,
    name: `preferences.${index}.enabled`,
  });

  return (
    <DashboardCard.Row className="grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto]!">
      <div className="min-w-0">
        <Typography className="text-sm!">{label}</Typography>
        <Typography className="mt-0.5 text-xs leading-tight" color="muted">
          {description}
        </Typography>
      </div>
      <Switch
        aria-label={label}
        isSelected={enabled.field.value}
        name={enabled.field.name}
        onChange={enabled.field.onChange}
        size="md"
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </DashboardCard.Row>
  );
}
