import type { PropsWithChildren } from "react";

import { Chip, Typography } from "@namera-ai/ui";
import { CheckmarkCircle02Icon, HugeiconsIcon, Key01Icon, Shield01Icon } from "@namera-ai/ui/icons";

import { Brand } from "@/components/brand";

export function AuthShell({ children }: PropsWithChildren) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.72fr)]">
      <section className="bg-background-secondary relative hidden overflow-hidden border-r border-separator px-12 py-10 lg:flex lg:flex-col">
        <Brand />

        <div className="my-auto max-w-xl py-20">
          <Chip color="accent" variant="soft">
            <Chip.Label>Programmable wallet infrastructure</Chip.Label>
          </Chip>
          <Typography.Heading className="mt-6 text-balance" level={1}>
            Secure execution for people, agents, and applications.
          </Typography.Heading>
          <Typography.Paragraph className="mt-5 max-w-lg text-pretty" color="muted">
            Create smart accounts, issue scoped access, and keep every action inside the policies
            your organization controls.
          </Typography.Paragraph>

          <ul className="mt-10 grid gap-4">
            <li className="flex items-center gap-3">
              <span className="bg-surface grid size-9 place-items-center rounded-lg border border-separator">
                <HugeiconsIcon aria-hidden="true" icon={Shield01Icon} size={18} />
              </span>
              <Typography.Paragraph>Policy-bound wallet operations</Typography.Paragraph>
            </li>
            <li className="flex items-center gap-3">
              <span className="bg-surface grid size-9 place-items-center rounded-lg border border-separator">
                <HugeiconsIcon aria-hidden="true" icon={Key01Icon} size={18} />
              </span>
              <Typography.Paragraph>Short-lived, scoped session keys</Typography.Paragraph>
            </li>
            <li className="flex items-center gap-3">
              <span className="bg-surface grid size-9 place-items-center rounded-lg border border-separator">
                <HugeiconsIcon aria-hidden="true" icon={CheckmarkCircle02Icon} size={18} />
              </span>
              <Typography.Paragraph>One auditable authorization layer</Typography.Paragraph>
            </li>
          </ul>
        </div>

        <Typography.Paragraph color="muted" size="xs">
          © {new Date().getFullYear()} Namera
        </Typography.Paragraph>
      </section>

      <section className="bg-background flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="my-auto flex w-full justify-center py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </section>
    </main>
  );
}
