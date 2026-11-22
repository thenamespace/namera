import type { CreateRule, ESTree, Visitor } from "@oxlint/plugins"
import * as path from "node:path"

// A module may import the `internal/` folder of its own feature, or of any folder above it (so every feature may use
// the root `src/internal/`). The `effect/` tree mirrors the Promise tree, so `src/effect/accounts/X.ts` counts as
// `src/accounts/X.ts` and may import `src/accounts/internal/`.
const featurePath = (src: string, file: string): string => {
  const relative = path.relative(src, file).split(path.sep)
  return path.join(src, ...(relative[0] === "effect" ? relative.slice(1) : relative))
}

const owningFolder = (file: string): string | undefined => {
  const parts = file.split(path.sep)
  const index = parts.lastIndexOf("internal")
  return index === -1 ? undefined : parts.slice(0, index).join(path.sep)
}

const rule: CreateRule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow importing the internal modules of another feature folder" }
  },
  create(context) {
    const file = context.filename
    const parts = file.split(path.sep)
    const srcIndex = parts.lastIndexOf("src")
    if (srcIndex === -1) return {}
    const src = parts.slice(0, srcIndex + 1).join(path.sep)
    const importer = path.dirname(featurePath(src, file))

    const check = (source: ESTree.StringLiteral | null | undefined) => {
      if (source === null || source === undefined) return
      if (!source.value.startsWith("./") && !source.value.startsWith("../")) return

      const target = path.resolve(path.dirname(file), source.value)
      const owner = owningFolder(path.relative(src, target).startsWith("..") ? "" : target)
      if (owner === undefined) return

      const relative = path.relative(owner, importer)
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        context.report({
          node: source,
          message: `${source.value} is internal to ${path.relative(src, owner) || "the root"}; import its public module`
        })
      }
    }

    return {
      ImportDeclaration: (node: ESTree.ImportDeclaration) => check(node.source),
      ExportAllDeclaration: (node: ESTree.ExportAllDeclaration) => check(node.source),
      ExportNamedDeclaration: (node: ESTree.ExportNamedDeclaration) => check(node.source)
    } as Visitor
  }
}

export default rule
