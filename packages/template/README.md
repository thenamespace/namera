# @namera-ai/template

Starter for new workspace packages. It is private and uses the Node library
TypeScript configuration by default; change those defaults when the new package
has different runtime or publishing requirements.

See [Repository and package boundaries](../../architecture/engineering/repository.md)
and [Feature development](../../architecture/engineering/development.md) before
introducing a new workspace. The template's intended scope is summarized in
[supporting workspace architecture](../../architecture/packages/supporting.md).

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

## Package checklist

- Keep the Klarity configuration and unbundled tsdown build unless the runtime
  requires something different.
- Keep the `namera-source` condition for direct workspace iteration and matching
  `publishConfig` paths for built output.
- Add dependencies to the package that imports them and prefer the workspace
  catalog for shared versions.
- Use `#/*` internally, package exports across workspaces, and `.js` on relative
  ESM imports.
- Keep one intentional public entry point unless consumers need a stable
  secondary entry such as `dto` or `model`.
- Update the new package README and root package map when its responsibility is
  established.
