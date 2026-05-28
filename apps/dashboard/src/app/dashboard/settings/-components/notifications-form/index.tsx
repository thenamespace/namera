import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { HeadingGroup } from "@/components/misc";
import { useUpdateUserPreference, useUserPreference } from "@/hooks/core";
import { useAutoSave } from "@/hooks/misc";
import { NotificationPreferences } from "@namera-ai/schema/database";

import { AccountUpdates } from "./account";
import { ProductUpdates } from "./product-updates";
import { TransactionUpdates } from "./transaction";

export const NotificationsForm = () => {
  const { data: userPreference } = useUserPreference();

  // TODO: update to skeleton or some loading state
  if (!userPreference) return null;

  return (
    <NotificationsFormInner
      key={userPreference.id}
      initialValues={userPreference.notificationPreferences}
    />
  );
};

const NotificationsFormInner = ({
  initialValues,
}: {
  initialValues: NotificationPreferences;
}) => {
  const { mutateAsync: updateUserPreference } = useUpdateUserPreference();

  const form = useForm<NotificationPreferences>({
    defaultValues: initialValues,
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(NotificationPreferences),
    ),
  });

  const saveNotifications = async (value: NotificationPreferences) => {
    await updateUserPreference({ notificationPreferences: value });
    toast.success("Notification preferences updated successfully");
    return value;
  };

  const { resetBaseline } = useAutoSave({
    form,
    onSave: saveNotifications,
  });

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(async (value) => {
        const savedValue = await saveNotifications(value);
        resetBaseline(savedValue);
      })}
    >
      <HeadingGroup
        size="lg"
        heading="Notifications"
        description="Subscribe to notifications for important updates and events."
      />
      <ProductUpdates form={form} />
      <AccountUpdates form={form} />
      <TransactionUpdates form={form} />
    </form>
  );
};
