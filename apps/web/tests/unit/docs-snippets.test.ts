import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VFile } from "vfile";
import { afterEach, expect, test } from "vitest";

import { expandDocSnippets } from "../../src/lib/docs/expand-snippets";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function markdownFile(path: string, value: string, dependencies: string[]) {
  return new VFile({
    path,
    value,
    data: { _compiler: { addDependency: (dependency: string) => dependencies.push(dependency) } },
  });
}

test("expands repeated and nested snippets into the source consumed by every output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "namera-doc-snippets-"));
  directories.push(directory);
  await writeFile(join(directory, "field.md"), "### walletId\n\nAccount UUID.\n");
  await writeFile(
    join(directory, "parameters.md"),
    "## Parameters\n\n<include>field.md</include>\n",
  );
  const dependencies: string[] = [];
  const file = markdownFile(
    join(directory, "page.mdx"),
    "## Usage\n\n<include>parameters.md</include>\n\n<include>field.md</include>\n\n## Errors\n",
    dependencies,
  );

  await expandDocSnippets(file);

  expect(String(file)).not.toContain("<include>");
  expect(String(file).match(/### walletId/g)).toHaveLength(2);
  expect(String(file)).toContain("## Parameters\n\n### walletId");
  expect(String(file)).toContain("## Errors");
  expect(dependencies).toContain(join(directory, "field.md"));
  expect(dependencies).toContain(join(directory, "parameters.md"));
});

test("fails the build on circular or missing snippets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "namera-doc-snippets-"));
  directories.push(directory);
  await writeFile(join(directory, "cycle.md"), "<include>cycle.md</include>\n");

  await expect(
    expandDocSnippets(markdownFile(join(directory, "page.mdx"), "<include>cycle.md</include>", [])),
  ).rejects.toThrow("Circular documentation snippet");
  await expect(
    expandDocSnippets(
      markdownFile(join(directory, "page.mdx"), "<include>missing.md</include>", []),
    ),
  ).rejects.toThrow("ENOENT");
});
