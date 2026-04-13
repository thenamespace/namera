import { NameraIcon } from "@namera-ai/ui/icons";
import { XLogoIcon } from "@phosphor-icons/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// import { useAISearchContext } from "@/components/ai/search/context";

export const githubDetails = {
  org: "thenamespace",
  repo: "namera",
};

// const AskAIButton = () => {
//   const { setOpen, open } = useAISearchContext();

//   if (open) return null;

//   return (
//     <Button onClick={() => setOpen(true)} size="sm" variant="outline">
//       <SparkleIcon />
//       Ask AI
//     </Button>
//   );
// };

export const baseOptions = (): BaseLayoutProps => {
  return {
    githubUrl: `https://github.com/${githubDetails.org}/${githubDetails.repo}`,
    links: [
      {
        icon: <XLogoIcon />,
        label: "X",
        text: "X",
        type: "icon",
        url: "https://x.com/namera_ai",
      },
      // {
      //   children: <AskAIButton />,
      //   type: "custom",
      // },
    ],
    nav: {
      // @ts-expect-error safe
      mode: "top",
      title: (
        <div className="text-lg flex flex-row gap-2 items-center text-accent-foreground px-2">
          <NameraIcon className="size-4.5 fill-accent-foreground" />
          <div className="font-medium">Namera</div>
        </div>
      ),
      transparentMode: "top",
    },
    searchToggle: {
      enabled: true,
    },
    themeSwitch: { enabled: false },
  };
};

export const blogBaseOptions = (): BaseLayoutProps => {
  return {
    nav: {
      // @ts-expect-error safe
      mode: "top",
      title: (
        <div className="text-lg flex flex-row gap-2 items-center px-1 text-[#C9D3EE]">
          <NameraIcon className="size-4.5 fill-[#C9D3EE]" />
          <div className="font-normal">Namera</div>
        </div>
      ),
      transparentMode: "top",
    },
    searchToggle: {
      enabled: true,
    },
    themeSwitch: { enabled: false },
  };
};

const tabs = ["protocol", "core", "cli", "mcp", "x402"] as const;
type Tab = (typeof tabs)[number];

export const getSection = (path: string | undefined): Tab => {
  if (!path) return "protocol";
  // (framework)/index.mdx
  const [dir] = path.split("/", 1);
  if (!dir) return "protocol";
  return (
    ({
      "(protocol)": "protocol",
      cli: "cli",
      core: "core",
      mcp: "mcp",
      x402: "x402",
    }[dir] as Tab) ?? "protocol"
  );
};
