import * as Fs from "node:fs"
import * as Path from "node:path"

type Manifest = {
  readonly name: string
  readonly private?: boolean
  readonly publishConfig: { readonly exports: Record<string, unknown> }
}

export const root = Path.resolve(import.meta.dirname, "..")

export const publishablePackages = () =>
  Fs.readdirSync(Path.join(root, "packages"))
    .map((folder) => Path.join(root, "packages", folder))
    .filter((dir) => Fs.existsSync(Path.join(dir, "package.json")))
    .map((dir) => ({ dir, manifest: JSON.parse(Fs.readFileSync(Path.join(dir, "package.json"), "utf8")) as Manifest }))
    .filter(({ manifest }) => manifest.private !== true)
