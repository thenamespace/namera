import { Array as Arr, Formatter, Record as Rec, String as Str } from "effect"

import type { PackedRelease } from "./packDir.ts"

/**
 * The manifests of a throwaway app that installs the packed tarballs: each release as a `file:`
 * dependency, overridden everywhere so the packages' dependencies on each other resolve to the
 * tarballs too (the new versions are not on npm yet), and every peer the packages declare,
 * optional ones included, so each entry can be imported. The pnpm workspace file is block-style
 * YAML with JSON scalars: pnpm edits it in place during install, which flow-style YAML prevents.
 */
export const consumerManifests = (
  releases: ReadonlyArray<PackedRelease>,
  tarballOf: (release: PackedRelease) => string,
  peers: Readonly<Record<string, string>>
) => {
  const tarballs = Rec.fromEntries(
    Arr.map(releases, (release) => [release.name, `file:${tarballOf(release)}`])
  )
  const dependencies = Rec.fromEntries(
    Arr.filter(Rec.toEntries(peers), ([name]) => !(name in tarballs))
  )
  return {
    packageJson: {
      name: "release-consumer",
      private: true,
      type: "module",
      dependencies: { ...dependencies, ...tarballs }
    },
    workspace: Arr.join(
      [
        // Dependencies' install scripts are denied, as a consumer's `allowBuilds` would; the packages
        // must work without them.
        "strictDepBuilds: false",
        "overrides:",
        ...Arr.map(
          Rec.toEntries(tarballs),
          ([name, tarball]) => `  ${Formatter.formatJson(name)}: ${Formatter.formatJson(tarball)}`
        ),
        ""
      ],
      "\n"
    )
  }
}

const isNullExport = (exports: Readonly<Record<string, unknown>>, subpath: string) =>
  Arr.some(Rec.toEntries(exports), ([key, target]) => {
    if (target !== null) return false
    if (!Str.includes("*")(key)) return key === subpath
    const [prefix, suffix] = key.split("*")
    return subpath.startsWith(prefix!) && subpath.endsWith(suffix!)
  })

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Import specifiers of a package's published JavaScript exports, without `./package.json` and
 * exports of other files (such as a JSON config). A pattern export (`"./*": "./dist/*.js"`)
 * expands to every file of the installed package (`files`, relative to its root) that the
 * pattern's target matches, minus the subpaths an export maps to `null`.
 */
export const publicEntries = (
  name: string,
  exports: Readonly<Record<string, unknown>>,
  files: ReadonlyArray<string>
) => {
  const subpaths: Array<string> = []
  for (const [key, target] of Rec.toEntries(exports)) {
    if (key === "./package.json" || typeof target !== "string" || !/\.[cm]?js$/.test(target)) continue
    if (!Str.includes("*")(key)) {
      subpaths.push(key)
      continue
    }
    const [targetPrefix, targetSuffix] = target.replace(/^\.\//, "").split("*")
    const pattern = new RegExp(`^${escapeRegExp(targetPrefix!)}(.+)${escapeRegExp(targetSuffix!)}$`)
    for (const file of files) {
      const match = file.match(pattern)
      if (match !== null) subpaths.push(key.replace("*", match[1]!))
    }
  }
  return Arr.map(
    Arr.dedupe(Arr.filter(subpaths, (subpath) => !isNullExport(exports, subpath))),
    (subpath) => (subpath === "." ? name : `${name}/${Str.slice(2)(subpath)}`)
  )
}

/** The bin names a package declares (`bin` as a string is named after the unscoped package). */
export const binNames = (name: string, bin: string | Readonly<Record<string, string>> | undefined) =>
  bin === undefined ? [] : typeof bin === "string" ? [name.replace(/^@[^/]+\//, "")] : Rec.keys(bin)

/**
 * A module importing every entry: run by Node as `.mjs`. An entry that exports nothing fails the
 * run.
 */
export const entriesModule = (specifiers: ReadonlyArray<string>) =>
  Arr.join(
    [
      ...Arr.map(
        specifiers,
        (specifier, index) =>
          `import * as entry${index} from "${specifier}"${specifier.endsWith(".json") ? ` with { type: "json" }` : ""};`
      ),
      "",
      `const entries = { ${
        Arr.join(
          Arr.map(specifiers, (specifier, index) => `"${specifier}": entry${index}`),
          ", "
        )
      } };`,
      "const empty = Object.entries(entries).filter(([, entry]) => Object.keys(entry).length === 0);",
      "if (empty.length > 0) throw new Error(\"no exports: \" + empty.map(([name]) => name).join(\", \"));",
      ""
    ],
    "\n"
  )
