import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

import { HeadingGroup } from "@/components/misc";

import { AccountUpdates } from "./account";
import { ProductUpdates } from "./product-updates";
import { NotificationsFormSchema } from "./schema";
import { TransactionUpdates } from "./transaction";

const handleSubmit = async (value: NotificationsFormSchema) => {
  console.log(value);
};

export const NotificationsForm = () => {
  const form = useForm<NotificationsFormSchema>({
    defaultValues: {},
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(NotificationsFormSchema),
    ),
  });

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(handleSubmit)}
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
