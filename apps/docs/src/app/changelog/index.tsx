import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";
import { NameraIcon } from "@namera-ai/ui/icons";
import {
  ClockCounterClockwiseIcon,
  GithubLogoIcon,
} from "@phosphor-icons/react";

import { getGithubReleases } from "@/lib/github";

import { Changelog } from "./-components";

const ChangelogPage = () => {
  const messages = Route.useLoaderData();
  return (
    <div className="flex flex-col lg:flex-row min-h-dvh relative">
      <div className="w-full lg:w-3/10 lg:border-r flex items-center lg:px-8 px-6 py-[10dvh] lg:py-0 lg:sticky top-0 lg:h-dvh">
        <div className="absolute top-4 left-4 flex flex-row gap-2 items-center">
          <NameraIcon className="fill-white size-4" />
          <div>Namera</div>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row items-center gap-1 text-muted-foreground">
            <ClockCounterClockwiseIcon className="size-4" />
            <h1 className="lg:text-sm text-xs">Changelog</h1>
          </div>
          <h1 className="text-2xl md:text-3xl xl:text-4xl heading-gradient">
            All changes, fixes, and updates
          </h1>
          <p className="text-sm text-accent-foreground max-w-[18rem] font-light">
            Every release shipped to Namera, straight from GitHub.
          </p>
          <hr className="border-t my-2" />
          <Button className="w-fit px-0" variant="link">
            <GithubLogoIcon />
            GitHub Releases
          </Button>
        </div>
      </div>
      <div className="w-full lg:w-7/10 lg:px-8 flex flex-col lg:py-16 px-4 lg:h-dvh overflow-hidden">
        <div className="absolute  top-4 right-4 flex flex-row items-center gap-2">
          <Button
            render={
              // biome-ignore lint/a11y/useAnchorContent: safe
              <a
                content="GitHub"
                href="https://github.com/thenamespace/namera"
                rel="noopener noreferrer"
                target="_blank"
                title="GitHub"
              />
            }
            variant="secondary"
          >
            <GithubLogoIcon />
            GitHub
          </Button>
          <Button>Home</Button>
        </div>
        <div className="flex flex-row items-center gap-4">
          <div className="text-sm text-muted-foreground">CHANGELOG</div>
          <div className="w-full border-t" />
        </div>
        <div className="overflow-scroll hide-scrollbar">
          {messages.map((release) => (
            <Changelog {...release} key={release.url} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/changelog/")({
  component: ChangelogPage,
  loader: async () => {
    const res = await getGithubReleases();
    return res;
  },
});
