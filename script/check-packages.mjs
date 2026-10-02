// oxlint-disable no-await-in-loop -- Exercise installed CLI commands one at a time.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { run as runAsync, startPackageRegistry } from "./package-registry.mjs";

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
const candidates = [];
let registry;

try {
  for (const path of packages) {
    run("pnpm", ["pack", "--pack-destination", directory], join(root, path));
  }
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".tgz"))) {
    const tarball = join(directory, file);
    const manifest = JSON.parse(
      execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
    );
    candidates.push({ manifest, tarball });
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
  registry = await startPackageRegistry(candidates);
  const consumer = join(directory, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }));
  const env = {
    ...process.env,
    NODE_OPTIONS: "",
    NODE_PATH: "",
    npm_config_cache: join(directory, "cache"),
  };
  const npmOptions = ["--no-audit", "--no-fund", "--registry", registry.origin];
  const cli = candidates.find(({ manifest }) => manifest.name === "@namera-ai/cli").manifest;
  const cliMetadata = await (await fetch(`${registry.origin}/${cli.name}/${cli.version}`)).json();
  assert.equal(
    Reflect.get(cliMetadata, "_hasShrinkwrap"),
    true,
    "Candidate registry must advertise the CLI lock",
  );
  const prefix = join(directory, "global");
  await runAsync(
    "npm",
    ["install", "--global", "--prefix", prefix, `${cli.name}@${cli.version}`, ...npmOptions],
    consumer,
    env,
  );
  const executable = join(prefix, "lib/node_modules/@namera-ai/cli/dist/index.js");
  const cliRequire = createRequire(executable);
  const platformRequire = createRequire(cliRequire.resolve("@effect/platform-node"));
  const effectVersion = cliRequire("effect/package.json").version;
  assert.equal(effectVersion, cli.dependencies.effect);
  assert.equal(cliRequire("@effect/platform-node/package.json").version, effectVersion);
  assert.equal(platformRequire("@effect/platform-node-shared/package.json").version, effectVersion);
  for (const args of [["--version"], ["--help"], ["login", "--help"], ["mcp", "serve", "--help"]]) {
    await runAsync(process.execPath, [executable, ...args], consumer, env);
  }
  const api = createServer((request, response) => {
    if (request.url !== "/wallets" || request.headers["x-api-key"] !== "pack-smoke-test") {
      response.writeHead(400).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" }).end("[]");
  });
  await new Promise((done, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", done);
  });
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [executable, "--output", "json", "wallet", "list"],
      {
        cwd: consumer,
        timeout: 30_000,
        env: {
          ...env,
          NAMERA_API_KEY: "pack-smoke-test",
          NAMERA_API_URL: `http://127.0.0.1:${api.address().port}`,
        },
      },
    );
    assert.deepEqual(JSON.parse(stdout), []);
  } finally {
    api.closeAllConnections();
    await new Promise((done) => api.close(done));
  }
  await runAsync(
    "npm",
    [
      "install",
      ...candidates
        .filter(({ manifest }) => manifest.name !== cli.name)
        .map(({ manifest }) => `${manifest.name}@${manifest.version}`),
      ...npmOptions,
    ],
    consumer,
    env,
  );
  await runAsync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
    import assert from 'node:assert/strict';
    import { NameraClient } from '@namera-ai/sdk';
    import { NameraApi } from '@namera-ai/api';
    import { WalletId } from '@namera-ai/protocol';
    import '@namera-ai/protocol/dto';
    import { Schema } from 'effect';
    import { OpenApi } from 'effect/unstable/httpapi';
    assert.ok(OpenApi.fromApi(NameraApi).paths['/wallets']);
    assert.equal(Schema.decodeSync(WalletId)('01a00407-5961-75cf-933e-9cfd0336ec16'), '01a00407-5961-75cf-933e-9cfd0336ec16');
    let requested = false;
    const client = new NameraClient({ apiKey: 'smoke-test', fetch: async (url, init) => {
      assert.equal(url.toString(), 'https://api.namera.ai/wallets');
      assert.equal(init.headers['x-api-key'], 'smoke-test');
      requested = true;
      return new Response('[]', { headers: { 'content-type': 'application/json' } });
    }});
    assert.deepEqual(await client.wallets.list(), { success: true, data: [], error: null });
    assert.ok(requested);
    console.log('Clean npm CLI, SDK, API and protocol smoke tests passed.');
  `,
    ],
    consumer,
    env,
  );
} finally {
  await registry?.close();
  rmSync(directory, { recursive: true, force: true });
}
