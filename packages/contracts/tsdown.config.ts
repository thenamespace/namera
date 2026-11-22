import defineConfig from "klarity/tsdown/library"

export default defineConfig({
  exports: { devExports: "workspace-source" },
  // WARNING: drop these once TypeScript 7.1 is stable; never suppress any other warning.
  suppressWarnings: [
    /^TypeScript 7\.0 does not yet have a stable API and is experimental\. Some options will be unavailable\.$/,
    /^The `tsgo` generator on TypeScript 7\.0 is deprecated/
  ]
})
