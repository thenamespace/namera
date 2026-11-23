import {
  Array as Arr,
  Console,
  DateTime,
  Effect,
  FileSystem,
  Formatter,
  Order,
  Path,
  Record as Rec,
  Schema,
  String as Str
} from "effect"
import { Command, Flag } from "effect/cli"

import { CheckFailed, SetupError, type ToolFailed } from "../errors.ts"
import { binNames, consumerManifests, entriesModule, publicEntries } from "../release/consumer.ts"
import { checksums, integrityOf, planProblems, readPackDir } from "../release/packDir.ts"
import { Tools } from "../services/Tools.ts"

const PackageManifest = Schema.fromJsonString(
  Schema.Struct({
    name: Schema.String,
    private: Schema.optionalKey(Schema.Boolean),
    exports: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
    peerDependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
    bin: Schema.optionalKey(Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.String)]))
  })
)

const readManifest = Effect.fn("releaseCheck.readManifest")(function*(file: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString(file).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(PackageManifest)),
    Effect.mapError((cause) => SetupError.make({ message: `${file}: ${String(cause)}` }))
  )
})

const fail = (problems: ReadonlyArray<string>) =>
  problems.length === 0
    ? Effect.void
    : Effect.fail(CheckFailed.make({ check: "release-check", problems }))

const publishablePackages = Effect.fn("releaseCheck.publishablePackages")(
  function*(root: string) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const packagesDir = path.join(root, "packages")
    const folders = yield* fs.readDirectory(packagesDir)
    const found = []
    for (const folder of Arr.sort(folders, Order.String)) {
      const file = path.join(packagesDir, folder, "package.json")
      if (!(yield* fs.exists(file))) continue
      const manifest = yield* readManifest(file)
      if (manifest.private !== true) found.push(manifest)
    }
    return found
  },
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) }))
)

/**
 * Verifies a `changeset pack` directory before it is published: the plan releases every
 * publishable package with a tarball matching its integrity; publint and attw pass on each
 * tarball; a throwaway app installs the tarballs, imports every public entry in Node (pattern
 * exports expanded to the files they match) and runs every bin with `--help`. Writes
 * `<pack-dir>/verification.json` and never changes the plan or archives.
 */
export const releaseCheck = Effect.fn("releaseCheck")(
  function*(packDirArgument: string) {
    const tools = yield* Tools
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const packDir = path.resolve(packDirArgument)
    const reportFile = path.join(packDir, "verification.json")

    const before = yield* checksums(packDir, "verification.json")
    const { releases, problems: readProblems, integrities } = yield* readPackDir(packDir)
    const packages = yield* publishablePackages(path.resolve("."))

    const checks: Array<{ readonly name: string; readonly problems: ReadonlyArray<string> }> = []
    const step = <R>(name: string, check: Effect.Effect<unknown, CheckFailed | ToolFailed, R>) =>
      check.pipe(
        Effect.as<ReadonlyArray<string>>([]),
        Effect.catchTags({
          CheckFailed: (failed) => Effect.succeed(failed.problems),
          ToolFailed: (failed) => Effect.succeed([`${failed.tool}:`, Str.trim(failed.output)])
        }),
        Effect.tap((problems) => Effect.sync(() => checks.push({ name, problems }))),
        Effect.map((problems) => problems.length === 0)
      )

    const planOk = yield* step(
      "plan",
      fail([
        ...readProblems,
        ...planProblems(
          releases,
          Arr.map(packages, (manifest) => manifest.name),
          integrities
        )
      ])
    )

    if (planOk) {
      const consumer = yield* fs.makeTempDirectoryScoped({ prefix: "release-check-" })
      const tarballOf = (release: { readonly tarball: string }) =>
        path.join(consumer, "tarballs", path.basename(release.tarball))
      yield* fs.makeDirectory(path.join(consumer, "tarballs"))
      for (const release of releases) {
        yield* fs.copyFile(path.join(packDir, release.tarball), tarballOf(release))
      }

      for (const release of releases) {
        yield* step(`publint ${release.name}`, tools.run("publint", ["run", tarballOf(release)]))
        yield* step(
          `attw ${release.name}`,
          tools.run("attw", [tarballOf(release), "--profile", "esm-only", "--format", "ascii"])
        )
      }

      const peers = Rec.fromEntries(
        Arr.flatMap(packages, (manifest) => Rec.toEntries(manifest.peerDependencies ?? {}))
      )
      const manifests = consumerManifests(releases, tarballOf, peers)
      yield* fs.writeFileString(
        path.join(consumer, "package.json"),
        Formatter.formatJson(manifests.packageJson, { space: 2 })
      )
      yield* fs.writeFileString(path.join(consumer, "pnpm-workspace.yaml"), manifests.workspace)
      const installed = yield* step(
        "consumer install",
        tools.run("pnpm", ["install", "--no-frozen-lockfile", "--prefer-offline"], {
          cwd: consumer
        })
      )

      if (installed) {
        const specifiers: Array<string> = []
        const bins: Array<string> = []
        for (const release of releases) {
          const installedDir = path.join(consumer, "node_modules", release.name)
          const manifest = yield* readManifest(path.join(installedDir, "package.json"))
          const files = yield* fs.readDirectory(installedDir, { recursive: true })
          specifiers.push(...publicEntries(release.name, manifest.exports ?? {}, files))
          bins.push(...binNames(release.name, manifest.bin))
        }
        yield* fs.writeFileString(path.join(consumer, "entries.mjs"), entriesModule(specifiers))
        yield* step(
          `consumer imports (${specifiers.length} entries)`,
          tools.run(process.execPath, ["entries.mjs"], { cwd: consumer })
        )
        for (const bin of bins) {
          yield* step(
            `bin ${bin} --help`,
            tools.run(path.join(consumer, "node_modules", ".bin", bin), ["--help"], { cwd: consumer })
          )
        }
      }
    }

    const after = yield* checksums(packDir, "verification.json")
    const changed = Arr.filter(
      [...new Set([...before.keys(), ...after.keys()])],
      (file) => before.get(file) !== after.get(file)
    )
    yield* step(
      "pack dir unchanged",
      fail(Arr.map(changed, (file) => `${file} changed during the check`))
    )

    const packed = []
    for (const release of releases) {
      const file = path.join(packDir, release.tarball)
      const bytes = (yield* fs.exists(file)) ? yield* fs.readFile(file) : undefined
      packed.push({
        ...release,
        npmIntegrity: bytes === undefined ? null : integrityOf("sha512", bytes)
      })
    }
    const problems = Arr.flatMap(
      checks,
      (check) => check.problems.length === 0 ? [] : [`[${check.name}]`, ...check.problems]
    )
    const now = yield* DateTime.now
    const report = Formatter.formatJson(
      {
        ok: problems.length === 0,
        checkedAt: DateTime.formatIso(now),
        packages: packed,
        checks: Arr.map(checks, (check) => ({ ...check, ok: check.problems.length === 0 }))
      },
      { space: 2 }
    )
    yield* fs.writeFileString(reportFile, `${report}\n`)

    for (const check of checks) {
      yield* Console.log(`${check.problems.length === 0 ? "ok  " : "FAIL"}  ${check.name}`)
    }
    if (problems.length > 0) return yield* CheckFailed.make({ check: "release-check", problems })
    return yield* Console.log(`release-check: ok (${releases.length} packages, ${reportFile})`)
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) }))
)

export const releaseCheckCommand = Command.make(
  "check",
  {
    packDir: Flag.Directory("pack-dir", { mustExist: true }).pipe(
      Flag.withDescription("Directory written by `changeset pack --out-dir`")
    )
  },
  ({ packDir }) => releaseCheck(packDir)
).pipe(Command.withDescription("Verify packed release tarballs before they are published"))
