import { execFileSync } from "node:child_process"
import * as Fs from "node:fs"
import * as Os from "node:os"
import * as Path from "node:path"
import { publishablePackages, root } from "./packages.ts"

for (const { dir, manifest } of publishablePackages()) {
  const dist = Path.join(dir, "dist")
  if (!Fs.existsSync(Path.join(dist, "index.d.ts"))) {
    console.error(`${manifest.name}: dist is missing; run \`pnpm build\` first`)
    process.exit(1)
  }

  const entrypoints = Object.entries(manifest.publishConfig.exports as Record<string, string | null>)
    .filter((entry): entry is [string, string] => entry[1] !== null).filter(([key]) =>
      key !== "./package.json" && !key.includes("*")
    )
    .map(([key, target]) => [Path.posix.join(manifest.name, key), [Path.join(dir, target.replace(/\.js$/, ".d.ts"))]])

  const work = Fs.mkdtempSync(Path.join(Os.tmpdir(), "namera-dist-types-"))
  try {
    Fs.writeFileSync(
      Path.join(work, "index.ts"),
      entrypoints.map(([entry], index) => `import * as _${index} from "${entry}"\nexport { _${index} }\n`).join("")
    )
    const config = {
      compilerOptions: {
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        target: "ES2022",
        lib: ["ES2024"],
        module: "ESNext",
        moduleResolution: "bundler",
        skipLibCheck: false,
        types: [],
        paths: {
          ...Object.fromEntries(entrypoints),
          [`${manifest.name}/*`]: [Path.join(dist, "*")]
        },
        typeRoots: [Path.join(root, "node_modules", "@types")]
      },
      files: ["index.ts"]
    }
    Fs.writeFileSync(Path.join(work, "tsconfig.json"), JSON.stringify(config))
    execFileSync("pnpm", ["exec", "tsc", "-p", Path.join(work, "tsconfig.json")], { cwd: root, stdio: "inherit" })
    console.log(`check-dist-types: ${manifest.name} ok`)
  } finally {
    Fs.rmSync(work, { recursive: true, force: true })
  }
}
