import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import * as Rec from "effect/Record"
import * as Result from "effect/Result"
import * as Str from "effect/String"

/**
 * A barrel file: everything above its `// @barrel` annotation is kept, everything below is generated from the
 * modules its pattern matches, relative to the barrel's folder.
 */
export interface Barrel {
  readonly header: string
  readonly pattern: string
}

/** The documentation a barrel copies from a module onto its `export * as`. */
export interface ModuleMetadata {
  readonly since: string
  readonly stability: "stable" | "unstable" | "experimental" | undefined
}

/** A module a barrel exports: its path relative to the barrel and its metadata. */
export interface BarrelModule {
  readonly path: string
  readonly metadata: ModuleMetadata
}

const annotation = /^\/\/\s*@barrel(?:\(([^)]+)\))?/

/** Finds the `// @barrel` annotation, as Effect's `codegen` does; the default pattern is `*.ts`. */
export const parseBarrel = (content: string): Barrel | undefined => {
  const lines = Str.split(content, "\n")
  const found = Arr.findFirstIndex(lines, (line) => annotation.test(line))
  if (Option.isNone(found)) return undefined
  const index = found.value

  let end = index
  while (end < lines.length - 1 && lines[end + 1]!.trimStart().startsWith("//")) end++

  return {
    header: Arr.join(lines.slice(0, end + 1), "\n"),
    pattern: annotation.exec(lines[index]!)?.[1] ?? "*.ts"
  }
}

/** Reads `@since` and `@stability` from a module's top-level TSDoc, or says what is missing. */
export const moduleMetadata = (content: string): Result.Result<ModuleMetadata, string> => {
  const block = /^(?:\s*\/\/[^\n]*\n)*\s*(\/\*\*[\s\S]*?\*\/)/.exec(content)?.[1]
  if (block === undefined) return Result.fail("missing top-level module TSDoc")

  const since = Arr.fromIterable(block.matchAll(/^\s*\*\s*@since(?:\s+(.*))?$/gm))
  if (since.length !== 1) {
    return Result.fail(since.length === 0 ? "missing module @since tag" : "multiple module @since tags")
  }
  const version = since[0]![1]?.trim() ?? ""
  if (version.length === 0) return Result.fail("empty module @since tag")

  const stability = /^\s*\*\s*@stability\s+(stable|unstable|experimental)\s*$/m.exec(block)?.[1] as
    | ModuleMetadata["stability"]
    | undefined
  return Result.succeed({ since: version, stability })
}

/** The name a module is exported under: its file name. */
export const exportName = (path: string): string => Str.replace(/\.ts$/, "")(path.split("/").at(-1) ?? path)

/** Renders a barrel: its header, then one documented `export * as` per module, in path order. */
export const renderBarrel = (barrel: Barrel, modules: ReadonlyArray<BarrelModule>): string => {
  const exports = Arr.map(
    Arr.sort(modules, Order.mapInput(Order.String, (module: BarrelModule) => module.path)),
    ({ metadata, path }) =>
      Arr.join(
        [
          "/**",
          ...(metadata.stability === undefined ? [] : [` * @stability ${metadata.stability}`]),
          ` * @since ${metadata.since}`,
          " */",
          `export * as ${exportName(path)} from "./${path}"`
        ],
        "\n"
      )
  )
  return exports.length === 0 ? `${barrel.header}\n` : `${barrel.header}\n\n${Arr.join(exports, "\n\n")}\n`
}

/** Export names two modules of one barrel both claim. */
export const duplicateNames = (modules: ReadonlyArray<BarrelModule>): ReadonlyArray<string> => {
  const byName = Arr.groupBy(modules, ({ path }) => exportName(path))
  return Arr.filter(Rec.keys(byName), (name) => byName[name]!.length > 1)
}

/**
 * The `exports` map of a package in Effect's shape, given the folders under `src` that have an `index.ts` and the
 * `internal` folders: the root, one entry per folder index, `"./*"` for every module, and `null` for internals and
 * index paths. `target` maps a source path without extension to the path the map points at.
 */
export const exportsMap = (
  folders: ReadonlyArray<string>,
  internals: ReadonlyArray<string>,
  target: (path: string) => string
): Record<string, string | null> => ({
  "./package.json": "./package.json",
  ".": target("index"),
  ...Rec.fromEntries(
    Arr.map(Arr.sort(folders, Order.String), (folder) => [`./${folder}`, target(`${folder}/index`)] as const)
  ),
  "./*": target("*"),
  ...Rec.fromEntries(Arr.map(Arr.sort(internals, Order.String), (folder) => [`./${folder}/*`, null] as const)),
  "./index": null,
  "./*/index": null
})
