import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";
import { expect, it } from "vitest";

const execute = promisify(execFile);
const appDirectory = fileURLToPath(new URL("../../", import.meta.url));
const uiConfig = fileURLToPath(new URL("../../../../packages/ui/tsconfig.json", import.meta.url));
const expectedNames = [
  ...["arbitrum", "base", "ethereum", "optimism"].map((name) => `chains/${name}.png`),
  ...["light", "dark"].flatMap((theme) =>
    [
      `brand/namera-${theme}.png`,
      `brand/oneclaw-${theme}.png`,
      `custody/computer-${theme}.png`,
    ].concat(
      ["website", "github", "x", "email", "linkedin"].map((name) => `social/${name}-${theme}.png`),
    ),
  ),
  "brand/alchemy.png",
].toSorted();

it("generates complete, nonempty email PNGs with stable dimensions and repeatable bytes", async () => {
  const workspace = await realpath(await mkdtemp(join(tmpdir(), "namera-email-assets-")));
  try {
    const copiedApp = join(workspace, "apps/email-templates");
    await mkdir(copiedApp, { recursive: true });
    await cp(join(appDirectory, "script"), join(copiedApp, "script"), { recursive: true });
    await cp(join(appDirectory, "package.json"), join(copiedApp, "package.json"));
    // Resolve installed tools/artwork from the repo, but the script's output root is the copy.
    await symlink(join(appDirectory, "node_modules"), join(copiedApp, "node_modules"));

    const generate = () =>
      execute(
        process.execPath,
        [
          "--import",
          import.meta.resolve("tsx"),
          "--conditions=namera-source",
          "script/generate-assets.tsx",
        ],
        {
          cwd: copiedApp,
          env: { PATH: process.env.PATH, TSX_TSCONFIG_PATH: uiConfig },
          timeout: 20_000,
        },
      );
    const first = await generate();
    const output = join(workspace, "assets/email-assets");
    expect(first.stdout).toContain(`Generated email assets in ${output}`);
    const names = (await readdir(output, { recursive: true }))
      .filter((name) => name.endsWith(".png"))
      .toSorted();
    expect(names).toEqual(expectedNames);
    const hashes = await Promise.all(
      names.map(async (name) => {
        const bytes = await readFile(join(output, name));
        expect(await sharp(bytes).metadata()).toMatchObject({
          format: "png",
          width: 512,
          height: name.startsWith("brand/namera-") ? 424 : 512,
          hasAlpha: true,
        });
        const statistics = await sharp(bytes).stats();
        if (!name.startsWith("chains/")) expect(statistics.channels[3]?.min, name).toBe(0);
        expect(statistics.channels[3]?.max, name).toBe(255);
        expect(
          statistics.channels.some((channel) => channel.min < channel.max),
          name,
        ).toBe(true);
        return createHash("sha256").update(bytes).digest("hex");
      }),
    );
    await generate();
    expect(
      await Promise.all(
        names.map(async (name) =>
          createHash("sha256")
            .update(await readFile(join(output, name)))
            .digest("hex"),
        ),
      ),
    ).toEqual(hashes);
    expect(new Set(hashes).size).toBe(hashes.length);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}, 45_000);
