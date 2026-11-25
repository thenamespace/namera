import { Array as Arr, Effect, FileSystem, Order, Path, Schema } from "effect"
import { globSync } from "glob"

const Manifest = Schema.fromJsonString(
  Schema.Struct({
    name: Schema.String,
    private: Schema.optionalKey(Schema.Boolean),
    sideEffects: Schema.optionalKey(Schema.Unknown)
  })
)

/** A publishable workspace package: its folder and the manifest fields the checks read. */
export type PublishablePackage = {
  readonly dir: string
  readonly name: string
  readonly sideEffects: unknown
}

/** The packages under `root/packages` that are not private, sorted by folder. */
export const publishablePackages = Effect.fn("publishablePackages")(function*(root: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packages: Array<PublishablePackage> = []
  for (const manifestFile of globSync("packages/*/package.json", { cwd: root, absolute: true })) {
    const manifest = yield* fs.readFileString(manifestFile).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Manifest)))
    if (manifest.private === true) continue
    packages.push({ dir: path.dirname(manifestFile), name: manifest.name, sideEffects: manifest.sideEffects })
  }
  return Arr.sort(packages, Order.mapInput(Order.String, (pkg: PublishablePackage) => pkg.dir))
})
