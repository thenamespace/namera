import { useState } from "react";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Field, FieldError, FieldLabel, InputGroup } from "@namera-ai/ui";
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
          className="w-full max-w-[30rem]"
          aria-busy={join.isPending}
        >
          <InputGroup
            aria-label="Join the waitlist"
            className={
              cn(
                "edge-top flex h-auto w-full flex-col items-stretch gap-1 rounded-[13px] border-1 border-hairline-strong sm:flex-row sm:items-center",
                "bg-surface/80 p-1 backdrop-blur-sm",
                "transition-colors duration-150 ease-out-quad",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus/60",
              ) ?? ""
            }
          >
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field className="min-w-0 flex-1">
                  <FieldLabel htmlFor="hero-waitlist-email" className="sr-only">
                    Email address
                  </FieldLabel>
                  <InputGroup.Input
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
                    className="h-11 w-full min-w-0 rounded-[10px] border-0 bg-transparent px-3 text-base text-foreground shadow-none ring-0 outline-none hover:bg-transparent focus:bg-transparent focus:shadow-none focus:ring-0 focus:outline-none"
                  />
                </Field>
              )}
            />
            <Button
              form="hero-waitlist-form"
              type="submit"
              size="sm"
              isDisabled={join.isPending}
              className={
                cn(
                  "group/join inline-flex h-11 w-full shrink-0 items-center gap-2 rounded-[10px] px-4 sm:w-auto",
                  "bg-button-light text-sm font-medium text-button-light-foreground",
                  "transition-[background-color,transform] duration-150 ease-out-quad",
                  "hover:bg-white active:scale-[0.98]",
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
          </InputGroup>

          <FieldError
            id="hero-waitlist-email-error"
            errors={
              form.formState.errors.email ? [{ message: "Enter a valid email address." }] : []
            }
          />
          <output className="block text-[0.8125rem] text-ink-subtle empty:hidden">{error}</output>
        </form>
      )}
    </div>
  );
};
