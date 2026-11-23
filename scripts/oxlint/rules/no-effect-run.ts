import type { CreateRule, ESTree, Visitor } from "@oxlint/plugins"

const message =
  "Only the Promise boundary (src/internal/promise.ts) runs effects; return the Effect and let `run` execute it."

// `run*` exports of effect/Effect: runPromise, runSync, runFork, runCallback and their Exit/With variants.
const isRunner = (name: string): boolean => /^run[A-Z]/.test(name)

const propertyName = (node: ESTree.MemberExpression): string | undefined =>
  node.property.type === "Identifier" ? node.property.name : undefined

const rule: CreateRule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow running effects outside the Promise boundary" }
  },
  create(context) {
    return {
      MemberExpression(node: ESTree.MemberExpression) {
        const name = propertyName(node)
        if (
          node.object.type === "Identifier" && node.object.name === "Effect" && name !== undefined && isRunner(name)
        ) {
          context.report({ node, message })
        }
      },
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (node.source.value !== "effect/Effect") return
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue
          const imported = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value
          if (isRunner(imported)) context.report({ node: specifier, message })
        }
      }
    } as Visitor
  }
}

export default rule
