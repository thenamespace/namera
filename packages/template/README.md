# @namera-ai/template

Starter for new workspace packages. It is private and uses the Node library
TypeScript configuration by default; change those defaults when the new package
has different runtime or publishing requirements.

## Structure

- `src/index.ts` — public entry point.
- `package.json` — package metadata, scripts, source condition, and publish exports.
- `tsconfig.json` — Node library TypeScript configuration.
- `tsdown.config.ts` — unbundled ESM build and declaration output.

## Usage

Copy this directory, rename the package, and replace the placeholder export:

```sh
cp -R packages/template packages/new-package
```

Then update `name`, `private`, dependencies, and exports in `package.json`. Keep
`private: true` unless the package is intentionally publishable.

Use `#/*` for imports within the package and export the supported public API from
`src/index.ts`.
