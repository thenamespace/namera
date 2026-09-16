import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packages = ["packages/protocol", "packages/api", "packages/sdk", "apps/cli"];
const publicNames = new Set([
  "@namera-ai/protocol",
  "@namera-ai/api",
  "@namera-ai/sdk",
  "@namera-ai/cli",
]);
const directory = mkdtempSync(join(tmpdir(), "namera-pack-check-"));
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: "inherit" });

try {
  for (const path of packages) {
    run("pnpm", ["pack", "--pack-destination", directory], join(root, path));
  }
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".tgz"))) {
    const tarball = join(directory, file);
    const manifest = JSON.parse(
      execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
    );
    for (const [name, version] of Object.entries({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
    })) {
      if (
        (name.startsWith("@namera-ai/") && !publicNames.has(name)) ||
        /^(workspace|catalog|link|file):/.test(version)
      ) {
        throw new Error(`${manifest.name} contains an unpublished dependency: ${name}@${version}`);
      }
    }
    run("pnpm", ["exec", "publint", tarball, "--strict"]);
    if (manifest.name !== "@namera-ai/cli") {
      run("pnpm", ["exec", "attw", tarball, "--profile", "esm-only"]);
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
