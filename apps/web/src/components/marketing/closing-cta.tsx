import { useState } from "react";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Field, FieldError, FieldLabel, Input } from "@namera-ai/ui";
import { ArrowRight02Icon, Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";
import { Controller, useForm } from "react-hook-form";

import { Container, Reveal, Section } from "#/components/marketing/primitives";
import { ShaderField } from "#/components/marketing/shader-field";

import { useJoinWaitlist } from "./use-join-waitlist";
import {
  WaitlistFormValidator,
  type WaitlistFormInput,
  type WaitlistFormOutput,
} from "./waitlist-schema";

export const ClosingCta = () => {
  const [joinedEmail, setJoinedEmail] = useState<string>();
  const [error, setError] = useState<string>();
  const form = useForm<WaitlistFormInput, unknown, WaitlistFormOutput>({
    resolver: standardSchemaResolver(WaitlistFormValidator),
    defaultValues: { email: "" },
  });
  const join = useJoinWaitlist({ onSuccess: setJoinedEmail, onError: setError });

  return (
    <Section id="waitlist" className="relative isolate overflow-hidden border-t-1 border-border">
      {/* masked, so the field dies out before it reaches the section's hairlines */}
      <ShaderField
        className={
          cn(
            "pointer-events-none absolute inset-0 -z-20 size-full",
            "[mask-image:radial-gradient(78%_72%_at_50%_48%,black_0%,black_38%,transparent_88%)]",
          ) ?? ""
        }
      />
      {/*
        The field runs bright in places, and body copy over a bright patch is a
        contrast failure. This holds the middle of the section near the page's
        own background so the type keeps its ratio, and lets the filaments carry
        the edges.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 52% at 50% 50%, var(--background) 0%, color-mix(in srgb, var(--background) 82%, transparent) 42%, transparent 78%)",
        }}
      />

      <Container>
        <Reveal>
          <div className="flex flex-col items-center py-12 text-center md:py-24">
            <h2 className="type-display-xl max-w-[15ch] text-balance text-foreground">
              Built for agents. Opening soon.
            </h2>
            <p className="type-lead mt-6 max-w-[46ch] text-pretty text-muted">
              Set the limits once. They hold on every chain and in every client. Join the waitlist
              and we will write to you the day Namera opens.
            </p>

            {joinedEmail ? (
              <output className="mt-10 block text-[0.9375rem] text-foreground">
                You are on the list. We will write to {joinedEmail} when Namera opens.
              </output>
            ) : (
              <form
                id="waitlist-form"
                noValidate
                onSubmit={form.handleSubmit((payload) => {
                  setError(undefined);
                  return join.mutate(payload);
                })}
                className="mt-10 w-full max-w-[28rem]"
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
                        <FieldLabel htmlFor="waitlist-email" className="sr-only">
                          Email address
                        </FieldLabel>
                        <Input
                          {...field}
                          id="waitlist-email"
                          type="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="you@company.com"
                          maxLength={254}
                          disabled={join.isPending}
                          aria-invalid={fieldState.invalid}
                          aria-describedby={fieldState.invalid ? "waitlist-email-error" : undefined}
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
                    form="waitlist-form"
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
                    {join.isPending ? "Joining..." : "Join the waitlist"}
                    <Icon
                      icon={ArrowRight02Icon}
                      aria-hidden
                      strokeWidth={2}
                      className="size-3.5 transition-transform duration-150 ease-out-quad group-hover/join:translate-x-0.5"
                    />
                  </Button>
                </div>

                <FieldError
                  id="waitlist-email-error"
                  errors={
                    form.formState.errors.email ? [{ message: "Enter a valid email address." }] : []
                  }
                />
                <output className="mt-3 block min-h-5 text-[0.8125rem] text-ink-subtle">
                  {error}
                </output>
              </form>
            )}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
};
