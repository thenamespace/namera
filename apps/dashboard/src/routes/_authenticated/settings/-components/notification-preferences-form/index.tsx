import { useEffect, useMemo, useRef } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { OrganizationId } from "@namera-ai/protocol";
import {
  UpdateNotificationPreferenceRequest,
  type ListNotificationPreferencesResponse,
} from "@namera-ai/protocol/dto";
import { FieldGroup } from "@namera-ai/ui";
import { useForm } from "react-hook-form";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import { useUpdateNotificationPreference } from "@/hooks/notification";
import { useAutoSave } from "@/hooks/use-auto-save";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { notificationPreferenceSections } from "./data";
import { NotificationPreferenceToggle } from "./preference-toggle";

type NotificationPreferencesFormProps = {
  initialPreferences: ListNotificationPreferencesResponse;
  organizationId: OrganizationId;
};

const NotificationPreferencesFormSchema = Schema.Struct({
  preferences: Schema.mutable(Schema.Array(UpdateNotificationPreferenceRequest)),
});

export type NotificationPreferencesFormInput = typeof NotificationPreferencesFormSchema.Encoded;
export type NotificationPreferencesFormValues = typeof NotificationPreferencesFormSchema.Type;

const preferenceKey = (preference: typeof UpdateNotificationPreferenceRequest.Encoded) =>
  `${preference.organizationId ?? "user"}:${preference.category}:${preference.topic}:${preference.channel}`;

export function NotificationPreferencesForm({
  initialPreferences,
  organizationId: activeOrganizationId,
}: NotificationPreferencesFormProps) {
  const updatePreference = useUpdateNotificationPreference({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t save preferences",
        description: "Your latest notification changes were not saved.",
      }),
  });
  const defaultValues = useMemo<NotificationPreferencesFormInput>(
    () => ({
      preferences: notificationPreferenceSections.flatMap((section) =>
        section.preferences.map((preference) => {
          const organizationId =
            preference.defaultValues.category === "organization" ? activeOrganizationId : null;
          const stored = initialPreferences.find(
            (candidate) =>
              candidate.category === preference.defaultValues.category &&
              candidate.topic === preference.defaultValues.topic &&
              candidate.channel === preference.defaultValues.channel &&
              candidate.organizationId === organizationId,
          );

          return {
            ...preference.defaultValues,
            organizationId,
            enabled: stored?.enabled ?? preference.defaultValues.enabled,
          };
        }),
      ),
    }),
    [activeOrganizationId, initialPreferences],
  );
  const savedPreferencesRef = useRef(
    new Map(
      defaultValues.preferences.map((preference) => [
        preferenceKey(preference),
        preference.enabled,
      ]),
    ),
  );
  const form = useForm<
    NotificationPreferencesFormInput,
    unknown,
    NotificationPreferencesFormValues
  >({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(NotificationPreferencesFormSchema)),
  });
  const { resetBaseline, save } = useAutoSave({
    form,
    onSave: async ({ preferences }) => {
      const changed = preferences.filter(
        (preference) =>
          savedPreferencesRef.current.get(preferenceKey(preference)) !== preference.enabled,
      );

      for (const payload of changed) {
        // Keep one mutation in flight because every request writes to the same Effect mutation atom.
        // oxlint-disable-next-line no-await-in-loop
        await updatePreference.mutateAsync({ payload });
      }

      savedPreferencesRef.current = new Map(
        preferences.map((preference) => [preferenceKey(preference), preference.enabled]),
      );
      showSuccessToast({ title: "Preferences saved" });
    },
  });

  useEffect(() => {
    savedPreferencesRef.current = new Map(
      defaultValues.preferences.map((preference) => [
        preferenceKey(preference),
        preference.enabled,
      ]),
    );
    form.reset(defaultValues);
    resetBaseline(defaultValues);
  }, [defaultValues, form, resetBaseline]);

  let preferenceIndex = 0;

  return (
    <form
      id="notification-preferences-form"
      noValidate
      onSubmit={form.handleSubmit(async (payload) => {
        await save();
        return payload;
      })}
    >
      <FieldGroup className="gap-8">
        {notificationPreferenceSections.map((section) => (
          <section key={section.heading}>
            <HeadingGroup className="mb-4">
              <HeadingGroup.Title>{section.heading}</HeadingGroup.Title>
            </HeadingGroup>
            <DashboardCardRoot>
              <DashboardCardContent>
                {section.preferences.map((preference) => {
                  const index = preferenceIndex++;

                  return (
                    <NotificationPreferenceToggle
                      control={form.control}
                      description={preference.description}
                      index={index}
                      key={`${preference.defaultValues.category}:${preference.defaultValues.topic}`}
                      label={preference.label}
                    />
                  );
                })}
              </DashboardCardContent>
            </DashboardCardRoot>
          </section>
        ))}
      </FieldGroup>
    </form>
  );
}
