import { createBundledHighlighter, createSingletonShorthands } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";

// UIKit imports Shiki's default WASM engine, which the dashboard CSP forbids.
// Vite redirects that import here so code blocks work without relaxing script-src.
const createHighlighter = createBundledHighlighter({
  langs: bundledLanguages,
  themes: bundledThemes,
  engine: () => createJavaScriptRegexEngine(),
});

export const { codeToHtml } = createSingletonShorthands(createHighlighter);
