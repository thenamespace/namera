import { useState } from "react";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Field, FieldError, FieldLabel, Input } from "@namera-ai/ui";
import { ArrowRight02Icon, Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";
import { Controller, useForm } from "react-hook-form";

import { useJoinWaitlist } from "./use-join-waitlist";
import {
  WaitlistFormValidator,
  type WaitlistFormInput,
  type WaitlistFormOutput,
} from "./waitlist-schema";

/*
 * The hero call to action: the ask. Leave an email, hear from us the day
 * Namera opens. Kept compact and left-aligned so it sits under the sentence
 * without competing with the product window below it.
 */
export const HeroCta = () => {
  const [joinedEmail, setJoinedEmail] = useState<string>();
  const [error, setError] = useState<string>();

  const form = useForm<WaitlistFormInput, unknown, WaitlistFormOutput>({
    resolver: standardSchemaResolver(WaitlistFormValidator),
    defaultValues: { email: "" },
  });
  const join = useJoinWaitlist({ onSuccess: setJoinedEmail, onError: setError });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.8125rem]">
        <span className="font-medium uppercase tracking-[0.14em] text-ink-subtle">
          Launching soon
        </span>
      </p>

      {joinedEmail ? (
        <output className="block text-[0.9375rem] text-foreground">
          You are on the list. We will write to {joinedEmail} the day Namera opens.
        </output>
      ) : (
        <form
          id="hero-waitlist-form"
          noValidate
          onSubmit={form.handleSubmit((payload) => {
            setError(undefined);
            return join.mutate(payload);
          })}
          className="w-full max-w-[28rem]"
          aria-busy={join.isPending}
        >
          <div
            className={cn(
              "edge-top flex items-center gap-2 rounded-xl border-1 border-hairline-strong",
              "bg-surface/80 p-1.5 backdrop-blur-sm",
              "transition-colors duration-150 ease-out-quad",
              "focus-within:border-accent/50",
            )}
          >
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field className="min-w-0 flex-1">
                  <FieldLabel htmlFor="hero-waitlist-email" className="sr-only">
                    Email address
                  </FieldLabel>
                  <Input
                    {...field}
                    id="hero-waitlist-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@company.com"
                    maxLength={254}
                    disabled={join.isPending}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.invalid ? "hero-waitlist-email-error" : undefined}
                    onChange={(event) => {
                      field.onChange(event);
                      setError(undefined);
                    }}
                    className="w-full min-w-0 bg-transparent px-3 text-foreground shadow-none"
                  />
                </Field>
              )}
            />
            <Button
              form="hero-waitlist-form"
              type="submit"
              isDisabled={join.isPending}
              className={
                cn(
                  "tap-target group/join inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-4",
                  "bg-foreground text-[0.875rem] font-medium text-background",
                  "transition-[background-color,transform] duration-150 ease-out-quad",
                  "hover:bg-foreground/90 active:scale-[0.98]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
                ) ?? ""
              }
            >
              {join.isPending ? "Joining..." : "Notify me at launch"}
              <Icon
                icon={ArrowRight02Icon}
                aria-hidden
                strokeWidth={2}
                className="size-3.5 transition-transform duration-150 ease-out-quad group-hover/join:translate-x-0.5"
              />
            </Button>
          </div>

          <FieldError
            id="hero-waitlist-email-error"
            errors={
              form.formState.errors.email ? [{ message: "Enter a valid email address." }] : []
            }
          />
          <output className="mt-2 block min-h-5 text-[0.8125rem] text-ink-subtle">{error}</output>
        </form>
      )}
    </div>
  );
};
