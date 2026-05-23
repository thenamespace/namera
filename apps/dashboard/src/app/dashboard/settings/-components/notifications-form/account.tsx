import type { NotificationPreferences } from "@namera-ai/schema";

import { Controller, type UseFormReturn } from "react-hook-form";

import { HeadingGroup } from "@/components/misc";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { Switch } from "@namera-ai/ui/components/ui/switch";

type Props = {
  form: UseFormReturn<NotificationPreferences>;
};

export const AccountUpdates = ({ form }: Props) => {
  return (
    <>
      <HeadingGroup size="md" heading="Account & Security" className="pb-0" />
      <div className="bg-card divide-input/50 flex flex-col gap-3 divide-y rounded-xl border px-4">
        <Controller
          name="account.activity"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-col">
                    <FieldLabel htmlFor={field.name}>
                      Account Activity
                    </FieldLabel>
                    <FieldDescription>
                      Get notified when a new login or authentication event is
                      detected.
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
          name="account.security"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-col">
                    <FieldLabel htmlFor={field.name}>
                      Security alerts
                    </FieldLabel>
                    <FieldDescription>
                      Get notified about suspicious activity or important
                      security events.
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
