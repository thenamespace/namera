// oxlint-disable-next-line effecttsgo/node-builtin-import -- synchronous digest of in-memory data; Effect has no hashing API
import { createHash } from "node:crypto"

import { Array as Arr, Console, Effect, FileSystem, Option, Path, Schedule, Schema, String as Str } from "effect"
import { Command, Flag } from "effect/cli"
import { HttpClient, HttpClientResponse } from "effect/http"

import { CheckFailed, SetupError, ToolFailed } from "../errors.ts"
import { integrityOf, planProblems, readPackDir } from "../release/packDir.ts"
import { Attestations, provenanceProblems } from "../release/provenance.ts"

const registry = "https://registry.npmjs.org"

const PublishedVersion = Schema.Struct({
  dist: Schema.Struct({
    integrity: Schema.String,
    tarball: Schema.String,
    attestations: Schema.optionalKey(Schema.Struct({ url: Schema.String }))
  })
})

const download = Effect.fn("releaseSmoke.download")(
  function*(url: string) {
    return yield* HttpClient.get(url).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((response) => response.arrayBuffer),
      Effect.mapBoth({
        onSuccess: (buffer) => new Uint8Array(buffer),
        onFailure: (cause) => ToolFailed.make({ tool: `fetch ${url}`, output: String(cause) })
      })
    )
  },
  Effect.retry({ times: 3, schedule: Schedule.exponential("2 seconds") })
)

const downloadJson = <S extends Schema.Top>(url: string, schema: S) =>
  download(url).pipe(
    Effect.flatMap((bytes) => Schema.decodeEffect(Schema.fromJsonString(schema))(new TextDecoder().decode(bytes))),
    Effect.mapError((cause) =>
      cause._tag === "ToolFailed"
        ? cause
        : SetupError.make({ message: `${url}: ${String(cause)}` })
    )
  )

const RepositoryManifest = Schema.fromJsonString(
  Schema.Struct({
    name: Schema.String,
    repository: Schema.Struct({ url: Schema.String })
  })
)

/**
 * The GitHub URL npm records as a package's provenance repository: the workspace package's
 * `repository.url` without `git+` and `.git`.
 */
const workspaceRepository = Effect.fn("releaseSmoke.workspaceRepository")(function*(name: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packagesDir = path.resolve("packages")
  const folders = yield* fs.readDirectory(packagesDir).pipe(Effect.orDie)
  for (const folder of folders) {
    const file = path.join(packagesDir, folder, "package.json")
    if (!(yield* fs.exists(file).pipe(Effect.orDie))) continue
    const manifest = yield* fs.readFileString(file).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(RepositoryManifest)),
      Effect.option
    )
    if (Option.isSome(manifest) && manifest.value.name === name) {
      return manifest.value.repository.url.replace(/^git\+/, "").replace(/\.git$/, "")
    }
  }
  return yield* SetupError.make({ message: `${name}: no workspace package with a repository.url` })
})

/**
 * Compares published packages with the pack dir the release verified and published: npm's
 * integrity and the downloaded tarball equal each packed archive, and with `provenance`, each
 * version has an SLSA provenance attestation for that archive from the release workflow of the
 * package's `repository.url`. Never publishes or rebuilds anything.
 */
export const releaseSmoke = Effect.fn("releaseSmoke")(function*(
  packDirArgument: string,
  provenance: boolean
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packDir = path.resolve(packDirArgument)

  const { releases, problems: readProblems, integrities } = yield* readPackDir(packDir)
  const problems = [
    ...readProblems,
    ...planProblems(
      releases,
      Arr.map(releases, (release) => release.name),
      integrities
    )
  ]
  if (releases.length === 0) problems.push("the publish plan releases nothing")
  if (problems.length > 0) return yield* CheckFailed.make({ check: "release-smoke", problems })

  for (const release of releases) {
    const id = `${release.name}@${release.version}`
    const packed = yield* fs.readFile(path.join(packDir, release.tarball)).pipe(Effect.orDie)
    const packedIntegrity = integrityOf("sha512", packed)

    const published = yield* downloadJson(
      `${registry}/${Str.replace("/", "%2f")(release.name)}/${release.version}`,
      PublishedVersion
    )
    if (published.dist.integrity !== packedIntegrity) {
      problems.push(`${id}: npm integrity ${published.dist.integrity}, packed ${packedIntegrity}`)
    }
    const tarball = yield* download(published.dist.tarball)
    if (integrityOf("sha512", tarball) !== packedIntegrity) {
      problems.push(`${id}: the registry tarball differs from the packed one`)
    }

    if (provenance) {
      const repository = yield* workspaceRepository(release.name)
      if (published.dist.attestations === undefined) {
        problems.push(`${id}: published without attestations`)
      } else {
        const attestations = yield* downloadJson(published.dist.attestations.url, Attestations)
        problems.push(
          ...provenanceProblems(
            attestations,
            {
              name: release.name,
              version: release.version,
              sha512Hex: createHash("sha512").update(packed).digest("hex")
            },
            repository
          )
        )
      }
    }
    yield* Console.log(`checked ${id}`)
  }

  if (problems.length > 0) return yield* CheckFailed.make({ check: "release-smoke", problems })
  return yield* Console.log(
    `release-smoke: ok (${releases.length} packages${provenance ? ", provenance" : ""})`
  )
})

export const releaseSmokeCommand = Command.make(
  "smoke",
  {
    packDir: Flag.Directory("pack-dir", { mustExist: true }).pipe(
      Flag.withDescription("The pack dir the release published")
    ),
    provenance: Flag.Boolean("provenance").pipe(
      Flag.withDescription(
        "Also require npm provenance from the release workflow of each package's `repository.url`"
      )
    )
  },
  ({ packDir, provenance }) => releaseSmoke(packDir, provenance)
).pipe(Command.withDescription("Compare published packages with the packed release tarballs"))
