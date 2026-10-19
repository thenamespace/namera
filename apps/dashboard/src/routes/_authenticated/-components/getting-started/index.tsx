import { useState } from "react";

import { Button, cn, Typography } from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  BookOpen01Icon,
  CheckmarkCircle02Icon,
  HugeiconsIcon,
  Key01Icon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";
import { useEventListener, useInterval } from "usehooks-ts";

import type { useGettingStarted } from "@/hooks/getting-started";

import { StepActions } from "./step-actions";
import { StepIllustration } from "./step-illustration";

import "./styles.css";

const steps = [
  {
    title: "Create your first wallet",
    description:
      "A home for your agent’s funds. Create a smart account that you control, then decide what your agent can do with it.",
    completed: "Your workspace has a wallet. You’ll find it under Accounts.",
  },
  {
    title: "Give your agent a session key",
    description:
      "Set the boundaries: which network, which actions, and how much your agent can spend. A session key gives it just that access.",
    completed:
      "Your session key is created. Make sure it’s enabled on your chosen network before using it.",
  },
  {
    title: "Connect your agent or app",
    description:
      "Use Namera from your code, terminal, or AI client. Pick one way to connect and make your first authenticated request.",
    completed: "An integration has used your workspace. Your agent or app is connected.",
  },
  {
    title: "Make your first transaction or signature",
    description:
      "Put it all together. Use your connected integration to send a transaction or sign a message within your session key’s permissions.",
    completed:
      "Your workspace has completed its first transaction or signature. You’re ready to build.",
  },
] as const;

const resources = [
  {
    title: "Understand your wallet",
    description: "How accounts and session keys work together.",
    href: "https://namera.ai/docs/sdk/accounts-and-session-keys",
    icon: Wallet01Icon,
  },
  {
    title: "Start with a template",
    description: "Build scoped permissions for a specific task.",
    href: "/recipes",
    icon: Key01Icon,
  },
  {
    title: "Build with Namera",
    description: "Examples and guides for your integration.",
    href: "https://namera.ai/docs",
    icon: BookOpen01Icon,
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
        <Typography.Paragraph className="mt-3 max-w-lg leading-relaxed" color="muted" size="sm">
          {setup.canFinish
            ? "Your wallet, permissions, and integration are in place. Your next idea starts here."
            : "From your first wallet to your first agent action. We’ll guide you through each step."}
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
                        <Typography.Paragraph
                          size="sm"
                          color="muted"
                          className="max-w-sm leading-relaxed"
                        >
                          {complete ? step.completed : step.description}
                        </Typography.Paragraph>
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

      <section aria-labelledby="setup-explore" className="mt-14 lg:mt-20">
        <Typography.Heading
          id="setup-explore"
          level={2}
          className="mb-5 text-sm text-muted"
          weight="normal"
        >
          A little more direction
        </Typography.Heading>
        <div className="grid gap-7 sm:grid-cols-3 sm:gap-8">
          {resources.map((resource) => (
            <a
              key={resource.title}
              href={resource.href}
              target={resource.href.startsWith("https:") ? "_blank" : undefined}
              rel={resource.href.startsWith("https:") ? "noreferrer" : undefined}
              className="setup-resource group border-t border-separator pt-5"
            >
              <HugeiconsIcon
                aria-hidden
                icon={resource.icon}
                size={20}
                className="mb-4 text-muted"
              />
              <div className="flex items-center justify-between gap-2">
                <Typography.Heading level={3} className="text-sm" weight="medium">
                  {resource.title}
                </Typography.Heading>
                <HugeiconsIcon
                  aria-hidden
                  icon={ArrowUpRight01Icon}
                  size={16}
                  className="text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
                />
              </div>
              <Typography.Paragraph color="muted" size="sm" className="mt-2 leading-relaxed">
                {resource.description}
              </Typography.Paragraph>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
