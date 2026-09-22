import { readFileSync, writeFileSync } from "node:fs";

// Reuse Vite's generated policy rather than maintaining a second CSP.
const headers = readFileSync(new URL("../dist/_headers", import.meta.url), "utf8");
const directives = headers
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const separator = line.indexOf(":");
    const name = line.slice(0, separator).trim();
    const value = JSON.stringify(line.slice(separator + 1).trim()).replaceAll("$", "\\$");
    return `add_header ${name} ${value} always;`;
  });
writeFileSync(new URL("../nginx-headers.conf", import.meta.url), `${directives.join("\n")}\n`);
