import { useState } from "react";

import { Button, cn, Typography } from "@namera-ai/ui";
import { CheckmarkCircle02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { useEventListener, useInterval } from "usehooks-ts";

import type { useGettingStarted } from "@/hooks/getting-started";

import { StepActions } from "./step-actions";
import { StepIllustration } from "./step-illustration";

import "./styles.css";

const steps = [
  {
    title: "Create your first account",
    description:
      "A Namera account is a smart wallet that holds funds and has its own blockchain address. You control the account and choose what your agent is allowed to do.",
    completed:
      "Your first account is ready. You can find its address, funds, and activity under Accounts.",
  },
  {
    title: "Give your agent a session key",
    description:
      "A session key is your agent’s access pass to an account. You choose what it can do, which networks it can use, how much it can spend, and when access expires.",
    completed:
      "Your session key is created. Make sure it’s enabled on your chosen network before using it.",
  },
  {
    title: "Connect your AI client",
    description: "Connect your AI client to Namera in three steps.",
    completed:
      "Your workspace has a connected integration. You can manage AI client access from MCP settings.",
  },
  {
    title: "Make your first transaction or signature",
    description: "Copy a prompt below to sign a message or send a transaction.",
    completed:
      "Your workspace has completed its first transaction or signature. You’re ready to build.",
  },
] as const;

type GettingStartedProps = { setup: ReturnType<typeof useGettingStarted> };

export function GettingStarted({ setup }: GettingStartedProps) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const nextStep = setup.completed.findIndex((complete) => !complete);
  const activeStep = selectedStep ?? (nextStep === -1 ? 3 : nextStep);

  useInterval(setup.refresh, setup.canFinish || setup.dismissed ? null : 30_000);
  useEventListener("focus", setup.refresh);

  return (
    <div className="getting-started">
      <header className="mb-12 lg:mb-16">
        <Typography.Heading
          level={2}
          className="text-3xl tracking-tight sm:text-[34px]"
          weight="medium"
        >
          {setup.canFinish ? "You’re all set." : "Let’s get you set up."}
        </Typography.Heading>
        <Typography.Paragraph className="mt-3 leading-relaxed" color="muted" size="sm">
          {setup.canFinish
            ? "Your account and agent are ready. You can start building."
            : "Set up your account, connect your AI client, and try your first action."}
        </Typography.Paragraph>
      </header>

      <div className="grid items-start gap-10 xl:grid-cols-[1.1fr_1fr] xl:gap-14">
        <section aria-label="Setup checklist" className="min-w-0">
          <div className="mb-5 flex items-center justify-between gap-3">
            <output aria-live="polite" className="text-sm text-muted">
              {setup.isLoading ? "Checking your progress…" : `${setup.count} of 4 complete`}
            </output>
            <progress className="sr-only" aria-label="Setup progress" value={setup.count} max={4} />
            <div aria-hidden="true" className="flex gap-1.5">
              {steps.map((step, index) => (
                <span
                  key={step.title}
                  className={cn(
                    "h-1 w-6 rounded-full",
                    index < setup.count ? "bg-accent" : "bg-default",
                  )}
                />
              ))}
            </div>
          </div>

          {setup.isError ? (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-separator p-3 text-sm"
            >
              <p>Some progress couldn’t be checked.</p>
              <Button size="sm" variant="secondary" onPress={setup.refresh}>
                Try again
              </Button>
            </div>
          ) : null}

          <ol className="border-t border-separator">
            {steps.map((step, index) => {
              const expanded = activeStep === index;
              const complete = setup.completed[index];
              return (
                <li key={step.title} className="border-b border-separator">
                  <Button
                    variant="ghost"
                    className="setup-step-trigger h-auto w-full justify-start gap-4 rounded-none px-0 py-6 text-left whitespace-normal"
                    aria-expanded={expanded}
                    aria-controls={`setup-step-${index}`}
                    id={`setup-step-trigger-${index}`}
                    // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
                    onPress={() => setSelectedStep(index)}
                  >
                    <span
                      className={cn(
                        "flex w-6 shrink-0 justify-center text-base tabular-nums",
                        complete ? "text-success" : "text-muted",
                      )}
                    >
                      {complete ? (
                        <HugeiconsIcon aria-hidden icon={CheckmarkCircle02Icon} size={21} />
                      ) : (
                        `0${index + 1}`
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-base font-medium leading-relaxed",
                        expanded ? "text-foreground" : "text-muted",
                      )}
                    >
                      {step.title}
                    </span>
                    {complete ? <span className="sr-only">Complete</span> : null}
                  </Button>
                  <section
                    id={`setup-step-${index}`}
                    aria-labelledby={`setup-step-trigger-${index}`}
                    hidden={!expanded}
                  >
                    {expanded ? (
                      <div className="pb-7 pl-10">
                        <Typography.Paragraph size="sm" color="muted" className="leading-relaxed">
                          {complete ? step.completed : step.description}
                        </Typography.Paragraph>
                        {index === 1 && !complete ? (
                          <Typography.Paragraph
                            size="sm"
                            color="muted"
                            className="mt-3 leading-relaxed"
                          >
                            We’ll prefill a key for your newest account on Base, valid for 30 days,
                            with message signing and full account access.
                          </Typography.Paragraph>
                        ) : null}
                        <div className="mt-5">
                          <StepActions step={index} complete={complete ?? false} setup={setup} />
                        </div>
                      </div>
                    ) : null}
                  </section>
                </li>
              );
            })}
          </ol>

          {setup.canFinish ? (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button variant="primary" onPress={setup.finish}>
                Done
              </Button>
              <span className="text-xs text-muted">This checklist will leave your sidebar.</span>
            </div>
          ) : null}
        </section>

        <div className="xl:sticky xl:top-10 xl:pt-10">
          <StepIllustration step={activeStep} finished={setup.canFinish} />
        </div>
      </div>
    </div>
  );
}
