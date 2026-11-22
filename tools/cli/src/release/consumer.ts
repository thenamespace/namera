import * as Arr from "effect/Array"
import * as Formatter from "effect/Formatter"
import * as Rec from "effect/Record"
import * as Str from "effect/String"

import type { PackedRelease } from "./packDir.ts"

/**
 * The manifests of a throwaway app that installs the packed tarballs: each release as a `file:`
 * dependency, overridden everywhere so the packages' dependencies on each other resolve to the
 * tarballs too (the new versions are not on npm yet), and every peer the packages declare,
 * optional ones included, so each entry can be imported, without running their build scripts. The
 * pnpm workspace file is block-style YAML with JSON scalars: pnpm edits it in place during install,
 * which flow-style YAML prevents.
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
        // The app only imports the entries, so dependencies' build scripts (native extras of optional peers) don't
        // matter, and pnpm must not fail the install for leaving them unapproved.
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

/**
 * Import specifiers of a package's published exports, without `./package.json`, patterns and the paths the map
 * blocks with `null`.
 */
export const publicEntries = (name: string, exports: Readonly<Record<string, unknown>>) =>
  Arr.map(
    Arr.filter(
      Rec.keys(exports),
      (subpath) => subpath !== "./package.json" && !Str.includes("*")(subpath) && exports[subpath] !== null
    ),
    (subpath) => (subpath === "." ? name : `${name}/${Str.slice(2)(subpath)}`)
  )

/**
 * A module importing every entry: run by Node as `.mjs`. An entry that exports nothing fails the
 * run.
 */
export const entriesModule = (specifiers: ReadonlyArray<string>) =>
  Arr.join(
    [
      ...Arr.map(
        specifiers,
        (specifier, index) => `import * as entry${index} from "${specifier}";`
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
