import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateNotificationPreferenceRequest } from "@namera-ai/protocol/dto";
import { Form, Switch, Typography } from "@namera-ai/ui";
import { useController, useForm } from "react-hook-form";

import { DashboardCard } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";

type NotificationPreferenceFormProps = {
  defaultValues: NotificationPreferenceInput;
  description: string;
  heading: string;
  label: string;
};

type NotificationPreferenceInput = typeof UpdateNotificationPreferenceRequest.Encoded;

const preferenceResolver = standardSchemaResolver(
  Schema.toStandardSchemaV1(UpdateNotificationPreferenceRequest),
);

function NotificationPreferenceForm({
  defaultValues,
  description,
  heading,
  label,
}: NotificationPreferenceFormProps) {
  const form = useForm<NotificationPreferenceInput, unknown, UpdateNotificationPreferenceRequest>({
    defaultValues,
    resolver: preferenceResolver,
  });
  const enabled = useController({ control: form.control, name: "enabled" });

  return (
    <section>
      <HeadingGroup className="mb-4">
        <HeadingGroup.Title>{heading}</HeadingGroup.Title>
      </HeadingGroup>
      <Form onSubmit={form.handleSubmit(() => undefined)} validationBehavior="aria">
        <DashboardCard>
          <DashboardCard.Content>
            <DashboardCard.Row className="grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <Typography className="text-sm!">{label}</Typography>
                <Typography className="mt-0.5 text-sm" color="muted">
                  {description}
                </Typography>
              </div>
              <Switch
                aria-label={label}
                isSelected={enabled.field.value}
                name={enabled.field.name}
                onChange={enabled.field.onChange}
                size="sm"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </DashboardCard.Row>
          </DashboardCard.Content>
        </DashboardCard>
      </Form>
    </section>
  );
}

const securityDefaults: NotificationPreferenceInput = {
  organizationId: null,
  category: "security",
  channel: "email",
  enabled: true,
};

const organizationDefaults: NotificationPreferenceInput = {
  organizationId: null,
  category: "organization",
  channel: "email",
  enabled: true,
};

export function NotificationPreferencesForm() {
  return (
    <div className="space-y-8">
      <NotificationPreferenceForm
        defaultValues={securityDefaults}
        description="Receive email alerts for new sign-ins and important account activity."
        heading="Account & security"
        label="Security alerts"
      />
      <NotificationPreferenceForm
        defaultValues={organizationDefaults}
        description="Receive email updates about invitations and organization activity."
        heading="Organization activity"
        label="Organization updates"
      />
    </div>
  );
}
