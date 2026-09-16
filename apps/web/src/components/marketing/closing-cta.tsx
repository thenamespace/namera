import { useState, type FormEvent } from "react";

import { ArrowRight02Icon, Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { Container, Reveal, Section } from "#/components/marketing/primitives";
import { ShaderField } from "#/components/marketing/shader-field";

/*
 * TODO: point this at the waitlist endpoint. While it is null the form does
 * not send anywhere, and it says so rather than showing a thank-you that would
 * be untrue to anyone who typed their address in. Setting it turns the sent
 * state on; nothing else here needs to change.
 */
const WAITLIST_ENDPOINT: string | null = null;

type Status = "idle" | "sent" | "unwired";

export const ClosingCta = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(WAITLIST_ENDPOINT === null ? "unwired" : "sent");
  };

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

            {status === "sent" ? (
              <output className="mt-10 block text-[0.9375rem] text-foreground">
                You are on the list. We will write to {email} the day it opens.
              </output>
            ) : (
              <form onSubmit={onSubmit} className="mt-10 w-full max-w-[28rem]">
                <div
                  className={cn(
                    "edge-top flex items-center gap-2 rounded-xl border-1 border-hairline-strong",
                    "bg-surface/80 p-1.5 backdrop-blur-sm",
                    "transition-colors duration-150 ease-out-quad",
                    "focus-within:border-accent/50",
                  )}
                >
                  <label htmlFor="waitlist-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setStatus("idle");
                    }}
                    className={cn(
                      "min-w-0 flex-1 bg-transparent px-3 text-[0.9375rem] text-foreground",
                      "placeholder:text-ink-subtle focus:outline-none",
                    )}
                  />
                  <button
                    type="submit"
                    className={cn(
                      "tap-target group/join inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-4",
                      "bg-foreground text-[0.875rem] font-medium text-background",
                      "transition-[background-color,transform] duration-150 ease-out-quad",
                      "hover:bg-foreground/90 active:scale-[0.98]",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
                    )}
                  >
                    Join the waitlist
                    <Icon
                      icon={ArrowRight02Icon}
                      aria-hidden
                      strokeWidth={2}
                      className="size-3.5 transition-transform duration-150 ease-out-quad group-hover/join:translate-x-0.5"
                    />
                  </button>
                </div>

                <output className="mt-3 block h-5 text-[0.8125rem] text-ink-subtle">
                  {status === "unwired" ? "Not wired up yet, so nothing was sent." : null}
                </output>
              </form>
            )}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
};
