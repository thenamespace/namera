import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateNotificationPreferenceRequest } from "@namera-ai/protocol/dto";
import { Form, Switch, Typography } from "@namera-ai/ui";
import { useController, useForm } from "react-hook-form";

import { DashboardCard } from "@/components/dashboard-card";

import type { NotificationPreferenceItem } from "./data";

const preferenceResolver = standardSchemaResolver(
  Schema.toStandardSchemaV1(UpdateNotificationPreferenceRequest),
);

export function NotificationPreferenceToggle({
  defaultValues,
  description,
  label,
}: NotificationPreferenceItem) {
  const form = useForm<
    typeof UpdateNotificationPreferenceRequest.Encoded,
    unknown,
    UpdateNotificationPreferenceRequest
  >({
    defaultValues,
    resolver: preferenceResolver,
  });
  const enabled = useController({ control: form.control, name: "enabled" });

  return (
    <Form onSubmit={form.handleSubmit(() => undefined)} validationBehavior="aria">
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
    </Form>
  );
}
