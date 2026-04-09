/** biome-ignore-all lint/style/useNamingConvention: safe */
/** biome-ignore-all lint/style/useNamingConvention: safe */

import { createServerFn } from "@tanstack/react-start";

import { serverEnv } from "./env/server";

type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  prerelease: boolean;
  published_at: string;
};

export type GithubReleaseMessage = {
  content: string;
  date: string;
  expandable: boolean;
  tag: string;
  title: string;
  url: string;
};

function getContent(content: string) {
  const lines = content.split("\n");
  const newContext = lines.map((line) => {
    if (line.trim().startsWith("## ") || line.trim().startsWith("### ")) {
      return line.split("date=")[0]?.trim();
    }
    if (line.trim().startsWith("- ")) {
      const mainContent = line.split(";")[0];
      const context = line.split(";")[2];

      const text = context ?? line;

      const matches = [...text.matchAll(/\[@([A-Za-z0-9-]+)\]\([^)]+\)/g)].map(
        (m) => m[1] || m[2] || "",
      );

      if (matches.length === 0) {
        return (mainContent || line).replace(/&nbsp;/g, "");
      }

      const mentions = matches
        .map((match) => {
          const username = match;
          const avatarUrl = `https://github.com/${username}.png`;
          return `[![${match}](${avatarUrl})](https://github.com/${username})`;
        })
        .filter(Boolean);
      return (
        (mainContent || line).replace(/&nbsp;/g, "") +
        " - " +
        mentions.join(" ")
      );
    }
    return line;
  });
  return newContext.join("\n");
}

export const getGithubReleases = createServerFn({ method: "GET" }).handler(
  async () => {
    const res = await fetch(
      "https://api.github.com/repos/thenamespace/namera/releases",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${serverEnv.githubToken}`,
        },
      },
    );

    if (!res.ok) {
      return [];
    }

    const releases = (await res.json()) as GitHubRelease[];
    const EXPANDABLE_LINE_THRESHOLD = 15;

    releases.sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
    );

    const messages = releases
      ?.filter((release) => !release.prerelease)
      .map((release) => {
        const content = getContent(release.body);
        const lineCount = content
          .split("\n")
          .filter((l) => l.trim().length > 0).length;
        return {
          content,
          date: new Date(release.published_at).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          expandable: lineCount > EXPANDABLE_LINE_THRESHOLD,
          tag: release.tag_name,
          title: release.name,
          url: release.html_url,
        };
      });

    return messages satisfies GithubReleaseMessage[];
  },
);
