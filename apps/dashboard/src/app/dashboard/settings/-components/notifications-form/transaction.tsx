import { Controller, type UseFormReturn } from "react-hook-form";

import { HeadingGroup } from "@/components/misc";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { Switch } from "@namera-ai/ui/components/ui/switch";

import type { NotificationsFormSchema } from "./schema";

type Props = {
  form: UseFormReturn<NotificationsFormSchema>;
};

export const TransactionUpdates = ({ form }: Props) => {
  return (
    <>
      <HeadingGroup size="md" heading="Transaction Activity" className="pb-0" />
      <div className="bg-card divide-input/50 flex flex-col gap-3 divide-y rounded-xl border px-4">
        <Controller
          name="transaction.smartAccount"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-col">
                    <FieldLabel htmlFor={field.name}>
                      Smart Account Activity
                    </FieldLabel>
                    <FieldDescription>
                      Get notified about Smart Account related transactions and
                      events.
                    </FieldDescription>
                  </div>
                  <Switch
                    id={field.name}
                    name={field.name}
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                    onCheckedChange={(checked) => field.onChange(checked)}
                    aria-invalid={isInvalid}
                    checked={field.value}
                  />
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
        <Controller
          name="transaction.sessionKey"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-col">
                    <FieldLabel htmlFor={field.name}>
                      Session Key Activity
                    </FieldLabel>
                    <FieldDescription>
                      Get notified about Session Key related transactions and
                      events.
                    </FieldDescription>
                  </div>
                  <Switch
                    id={field.name}
                    name={field.name}
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                    onCheckedChange={(checked) => field.onChange(checked)}
                    aria-invalid={isInvalid}
                    checked={field.value}
                  />
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
      </div>
    </>
  );
};
