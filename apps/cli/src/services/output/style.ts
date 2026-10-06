import { humanize, terminalText } from "./document.js";
import { feedbackStyle } from "./feedback.js";

export const paint = (value: string, code: number, colors: boolean): string =>
  colors ? `\u001b[${code}m${terminalText(value)}\u001b[0m` : terminalText(value);

export const statusText = (value: string, colors: boolean): string => {
  if (value === "active" || value === "installed") return paint(humanize(value), 32, colors);
  if (value === "revoked" || value === "failed") return paint(humanize(value), 31, colors);
  return paint(humanize(value), 33, colors);
};

export const successText = (message: string, colors: boolean): string =>
  paint(`${feedbackStyle(process.stdout).unicode ? "✓" : "OK"} ${message}`, 32, colors);

export const nextText = (message: string, colors: boolean): string =>
  paint(`${feedbackStyle(process.stdout).unicode ? "→" : "->"} ${message}`, 34, colors);

export const listArrow = (colors: boolean): string =>
  paint(feedbackStyle(process.stdout).unicode ? "→" : "->", 34, colors);

export const accountHeading = (name: string, colors: boolean): string =>
  colors ? `\u001b[1m${paint(name, 35, true)}` : terminalText(name);
