import readChangesets from "@changesets/read";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, FileSystem, Path } from "effect";

type VersionType = "major" | "minor" | "patch" | "none";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const cwd = path.join(process.cwd());

  const changesets = yield* Effect.promise(() => readChangesets(cwd));

  if (changesets.length === 0) {
    yield* Effect.logWarning(
      "No pending changesets found. Skipping docs generation.",
    );
    return;
  }

  // Date in YYYY-MM-DD format
  const date = new Date().toISOString().split("T")[0] as string;
  const packageChanges: Record<
    string,
    { type: VersionType; summary: string }[]
  > = {};

  for (const changeset of changesets) {
    for (const release of changeset.releases) {
      if (!packageChanges[release.name]) {
        packageChanges[release.name] = [];
      }

      packageChanges[release.name].push({
        summary: changeset.summary,
        type: release.type,
      });
    }
  }

  const effects = Object.entries(packageChanges).map(([pkg, changes]) =>
    Effect.gen(function* () {
      const safePkgName = pkg.replace("@namera-ai/", "").replace(/\//g, "-");
      const dirPath = path.join(
        cwd,
        "apps",
        "docs",
        "content",
        "changelog",
        safePkgName,
      );

      yield* fs.makeDirectory(dirPath, { recursive: true });
      const filePath = path.join(dirPath, `${date}.mdx`);

      let content = `---
title: ${pkg} Release - ${date}
date: ${date}
---\n\n`;

      content += `# ${pkg} Release Notes\n\n`;

      // Sort changes by type so Major changes appear at the top
      const sortOrder: Record<VersionType, number> = {
        major: 0,
        minor: 1,
        none: 3,
        patch: 2,
      };
      changes.sort((a, b) => sortOrder[a.type] - sortOrder[b.type]);

      for (const change of changes) {
        // Capitalize the change type (Major, Minor, Patch)
        const typeLabel =
          change.type.charAt(0).toUpperCase() + change.type.slice(1);
        content += `### ${typeLabel} Changes\n\n`;
        content += `${change.summary}\n\n`;
      }

      yield* fs.writeFileString(filePath, content);
      yield* Effect.log(
        `✅ Generated docs changelog for ${pkg} at content/changelog/${safePkgName}/${date}.mdx`,
      );
    }),
  );

  yield* Effect.all(effects, { concurrency: "unbounded" });
}).pipe(Effect.provide(BunServices.layer));

BunRuntime.runMain(program);
