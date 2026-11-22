import * as Glob from "glob"
import madge from "madge"

const files = Glob.globSync(["packages/*/src/**/*.ts", "tools/*/src/**/*.ts"])

const result = await madge(files, { detectiveOptions: { ts: { skipTypeImports: true } } })
const circular = result.circular()

if (circular.length > 0) {
  console.error("Circular dependencies found")
  console.error(circular)
  process.exit(1)
}
console.log(`circular: none in ${files.length} files`)
