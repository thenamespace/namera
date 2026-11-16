import defineConfig from "klarity/tsdown/library";

export default defineConfig({
  // Remove once TypeScript 7.1 is stable and in the catalog.
  suppressWarnings: [
    /^The `tsgo` generator on TypeScript 7\.0 is deprecated and will be removed in the next minor\. Upgrade to TypeScript 7\.1 or later\.$/,
  ],
});
