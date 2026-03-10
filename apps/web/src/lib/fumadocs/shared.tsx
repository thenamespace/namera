import { Link } from "@tanstack/react-router";

import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const githubDetails = {
  org: "envoy1084",
  repo: "agent-wallet",
};

export const baseOptions = (): BaseLayoutProps => {
  return {
    githubUrl: `https://github.com/${githubDetails.org}}/${githubDetails.repo}`,
    nav: {
      title: (
        <Link className="text-lg" to="/">
          Namera
        </Link>
      ),
      url: "/dashboard",
    },
    searchToggle: {
      enabled: true,
    },
    themeSwitch: { enabled: false },
  };
};

const tabs = ["framework", "core", "cli", "mcp", "x402"] as const;
type Tab = (typeof tabs)[number];

export const getSection = (path: string | undefined): Tab => {
  if (!path) return "framework";
  // (framework)/index.mdx
  const [dir] = path.split("/", 1);
  if (!dir) return "framework";
  return (
    ({
      "(framework)": "framework",
      cli: "cli",
      core: "core",
      mcp: "mcp",
      x402: "x402",
    }[dir] as Tab) ?? "framework"
  );
};
