import { useEffect, useState } from "react";

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
 * The hero call to action: a countdown to launch, then the ask.
 *
 * Namera opens on 1 October. The clock does the persuading — a fixed date the
 * reader can feel getting closer — and the field underneath turns that urgency
 * into a single, low-friction action: leave an email, hear from us the day it
 * opens. Kept compact and left-aligned so it sits under the sentence without
 * competing with the product window below it.
 */
const LAUNCH_MS = Date.UTC(2026, 9, 1, 0, 0, 0); // 1 October 2026, 00:00 UTC

type Remaining = {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly done: boolean;
};

const ZERO: Remaining = { days: 0, hours: 0, minutes: 0, seconds: 0, done: false };

const remainingFrom = (now: number): Remaining => {
  const diff = LAUNCH_MS - now;
  if (diff <= 0) return { ...ZERO, done: true };
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: false,
  };
};

const pad2 = (value: number) => String(value).padStart(2, "0");

export const HeroCta = () => {
  const [remaining, setRemaining] = useState<Remaining>(ZERO);
  const [joinedEmail, setJoinedEmail] = useState<string>();
  const [error, setError] = useState<string>();

  const form = useForm<WaitlistFormInput, unknown, WaitlistFormOutput>({
    resolver: standardSchemaResolver(WaitlistFormValidator),
    defaultValues: { email: "" },
  });
  const join = useJoinWaitlist({ onSuccess: setJoinedEmail, onError: setError });

  /* Server render is a still clock at zero; the client starts it and the digits
     animate up from zero on mount, then tick once a second. */
  useEffect(() => {
    const tick = () => {
      setRemaining(remainingFrom(Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
        <span className="font-medium uppercase tracking-[0.14em] text-ink-subtle">
          {remaining.done ? "Namera is live" : "Launching 1 October"}
        </span>
        {remaining.done ? null : (
          <>
            <span aria-hidden className="text-separator">
              ·
            </span>
            <span className="tabular-nums text-muted">
              {remaining.days}d {pad2(remaining.hours)}h {pad2(remaining.minutes)}m{" "}
              {pad2(remaining.seconds)}s
            </span>
          </>
        )}
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
