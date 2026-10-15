# @namera-ai/template

Private starter for a TypeScript workspace package. Provides Klarity's Node
configuration, an unbundled ESM build, and a `namera-source` development export.

## Create a package

From the repository root:

```sh
cp -R packages/template packages/new-package
```

Update the name, dependencies, exports, source, and README. Keep `private: true`
unless publication is intentional.

Use `#/*` internally, package exports across workspaces, and `.js` on relative
ESM imports. Keep source and published export paths aligned.

Run the renamed package's `typecheck`, `lint`, and `build` scripts.
See [development](../../architecture/engineering/development.md).
