import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const pages = [
  ["overview", "apps/web/content/docs/sdk/guides/templates/index.mdx"],
  ["usdc-allowance", "apps/web/content/docs/sdk/guides/templates/usdc-allowance.mdx"],
  ["custom", "apps/web/content/docs/sdk/guides/templates/create-custom-template.mdx"],
  ["custom-tests", "apps/web/content/docs/sdk/guides/templates/test-custom-template.mdx"],
  ["readme", "packages/templates/README.md"],
];

// Check the actual published-package examples, without running SDK mutations.
export function checkTemplateDocs(root, consumer, env) {
  const directory = join(consumer, "template-docs");
  mkdirSync(directory);
  for (const [name, path] of pages) {
    const markdown = readFileSync(join(root, path), "utf8");
    const files = new Map();
    for (const [, title, code] of markdown.matchAll(/```ts(?: title="([^"]+)")?\n([\s\S]*?)```/g)) {
      const filename = title ?? "index.ts";
      files.set(filename, `${files.get(filename) ?? ""}${code}\n`);
    }
    assert.ok(files.size, `${path} must contain a checked example`);
    mkdirSync(join(directory, name));
    for (const [filename, source] of files) {
      writeFileSync(join(directory, name, filename), source);
    }
    for (const [, destination] of markdown.matchAll(/\]\((\/docs[^\s)]*)\)/g)) {
      const slug = destination.split("#")[0].replace(/^\/docs\/?/, "");
      const base = join(root, "apps/web/content/docs", slug);
      assert.ok(
        existsSync(`${base}.mdx`) || existsSync(join(base, "index.mdx")),
        `${path} links to missing documentation ${destination}`,
      );
    }
  }
  copyFileSync(
    join(directory, "custom/native-allowance.ts"),
    join(directory, "custom-tests/native-allowance.ts"),
  );
  const tsconfig = join(directory, "tsconfig.json");
  writeFileSync(
    tsconfig,
    JSON.stringify({
      compilerOptions: {
        target: "ES2023",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        exactOptionalPropertyTypes: true,
        skipLibCheck: true,
        noEmit: true,
        types: ["node"],
        typeRoots: [join(root, "node_modules/@types")],
      },
      include: ["**/*.ts"],
    }),
  );
  execFileSync(join(root, "node_modules/.bin/tsc"), ["--project", tsconfig], {
    cwd: consumer,
    env,
    stdio: "inherit",
  });
  execFileSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(join(root, "node_modules/tsx/dist/loader.mjs")).href,
      "--test",
      join(directory, "custom-tests/native-allowance.test.ts"),
    ],
    { cwd: consumer, env, stdio: "inherit" },
  );

  const reference = readFileSync(join(root, pages[1][1]), "utf8");
  const json = /```json\n([\s\S]*?)```/.exec(reference)?.[1];
  assert.ok(json, "The USDC reference must show the complete generated output");
  const expected = JSON.parse(json);
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
      import assert from 'node:assert/strict';
      import { Schema } from 'effect';
      import { CreateEvmSessionKeyRequest } from '@namera-ai/protocol/dto';
      import { usdcAllowanceTemplate } from '@namera-ai/templates';
      const now = 1800000000;
      const output = usdcAllowanceTemplate.build({
        networks: ['eip155:5042002'], allowance: '100',
        expiresAt: new Date((now + 86400) * 1000).toISOString(),
      }, { now });
      assert.deepEqual({
        onchain: Schema.encodeSync(CreateEvmSessionKeyRequest.fields.onchain)(output.onchain),
        policies: Schema.encodeSync(CreateEvmSessionKeyRequest.fields.policies)(output.policies),
      }, ${JSON.stringify(expected)});
      console.log('Template documentation types, custom tests, links and JSON output passed.');
      `,
    ],
    { cwd: consumer, env, stdio: "inherit" },
  );
}
