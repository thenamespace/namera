import { Navigate } from "@tanstack/react-router";

import { HugeiconsIcon, LinkSquare02Icon } from "@namera-ai/ui/icons";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { useGettingStarted } from "@/hooks/getting-started";

import { GettingStarted } from "./index";

export function GettingStartedPage() {
  const setup = useGettingStarted();
  if (setup.dismissed || !setup.available) return <Navigate to="/" replace />;

  return (
    <DashboardPage>
      <DashboardPage.Header className="border-b border-separator">
        <DashboardPage.Title>
          <HeadingGroup.Title className="text-sm" level={1} weight="normal">
            Get started
          </HeadingGroup.Title>
        </DashboardPage.Title>
        <DashboardPage.Side>
          <a
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
            href="https://namera.ai/docs"
            target="_blank"
            rel="noreferrer"
          >
            Documentation <HugeiconsIcon aria-hidden icon={LinkSquare02Icon} size={16} />
          </a>
        </DashboardPage.Side>
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-10 lg:px-16 lg:py-14">
        <GettingStarted setup={setup} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
