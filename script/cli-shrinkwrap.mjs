// oxlint-disable no-await-in-loop -- Pack in dependency order without competing builds.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { run, startPackageRegistry } from "./package-registry.mjs";

const root = resolve(import.meta.dirname, "..");
const paths = ["packages/protocol", "packages/api", "packages/sdk", "apps/cli"];
const manifests = paths.map((path) => JSON.parse(readFileSync(join(root, path, "package.json"))));
const cli = manifests.at(-1);
const catalog = JSON.parse(
  execFileSync("pnpm", ["config", "get", "catalog", "--json"], {
    cwd: root,
    encoding: "utf8",
  }),
);
const dependencies = (manifest) =>
  Object.fromEntries(
    Object.entries(manifest.dependencies).map(([name, version]) => [
      name,
      version === "catalog:"
        ? catalog[name]
        : version === "workspace:*"
          ? manifests.find((entry) => entry.name === name).version
          : version,
    ]),
  );
const filename = join(root, "apps/cli/npm-shrinkwrap.json");

if (process.argv.includes("--refresh")) {
  const directory = mkdtempSync(join(tmpdir(), "namera-cli-lock-"));
  let registry;
  try {
    for (const path of paths.slice(0, -1)) {
      await run("pnpm", ["pack", "--pack-destination", directory], join(root, path));
    }
    const packages = readdirSync(directory)
      .filter((file) => file.endsWith(".tgz"))
      .map((file) => {
        const tarball = join(directory, file);
        const manifest = JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"]));
        return { manifest, tarball };
      });
    registry = await startPackageRegistry(packages);
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        name: cli.name,
        version: cli.version,
        dependencies: dependencies(cli),
        overrides: { "@effect/platform-node-shared": catalog["@effect/platform-node"] },
      }),
    );
    await run(
      "npm",
      [
        "install",
        "--package-lock-only",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--registry",
        registry.origin,
      ],
      directory,
    );
    const lock = JSON.parse(readFileSync(join(directory, "package-lock.json")));
    for (const entry of Object.values(lock.packages)) {
      if (entry.resolved?.startsWith(registry.origin)) {
        // Sibling release artifacts do not exist on npm yet. Resolve their exact
        // versions at install time; external dependencies retain their integrity.
        delete entry.resolved;
        delete entry.integrity;
      }
    }
    writeFileSync(filename, `${JSON.stringify(lock, null, 2)}\n`);
  } finally {
    await registry?.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

const lock = JSON.parse(readFileSync(filename));
const external = (deps) =>
  Object.entries(deps ?? {})
    .filter(([name]) => !name.startsWith("@namera-ai/"))
    .sort();
for (const manifest of manifests) {
  const entry = lock.packages[manifest === cli ? "" : `node_modules/${manifest.name}`];
  if (
    !entry ||
    JSON.stringify(external(entry.dependencies)) !==
      JSON.stringify(external(dependencies(manifest)))
  ) {
    throw new Error(`Changed dependencies in ${manifest.name}; run pnpm cli:lock`);
  }
}
// Changesets updates sibling versions before publishing; no dependency re-resolution.
lock.version = cli.version;
lock.packages[""].version = cli.version;
lock.packages[""].dependencies = dependencies(cli);
for (const manifest of manifests.slice(0, -1)) {
  const entry = lock.packages[`node_modules/${manifest.name}`];
  if (!entry) throw new Error(`Missing locked ${manifest.name}; run pnpm cli:lock`);
  entry.version = manifest.version;
  entry.dependencies = dependencies(manifest);
  delete entry.resolved;
  delete entry.integrity;
}
for (const name of ["effect", "@effect/platform-node", "@effect/platform-node-shared"]) {
  const expected =
    name === "@effect/platform-node-shared" ? catalog["@effect/platform-node"] : catalog[name];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path.endsWith(`node_modules/${name}`) && entry.version !== expected) {
      throw new Error(`Stale ${name} lock; run pnpm cli:lock`);
    }
  }
}
writeFileSync(filename, `${JSON.stringify(lock, null, 2)}\n`);
execFileSync("pnpm", ["exec", "oxfmt", "--write", filename], { cwd: root, stdio: "inherit" });
