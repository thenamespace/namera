import { terminalText } from "./document.js";

export interface FeedbackStyle {
  readonly colors: boolean;
  readonly unicode: boolean;
}

export const feedbackStyle = (
  stream: { readonly isTTY?: boolean; readonly hasColors?: () => boolean } = process.stderr,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): FeedbackStyle => {
  const terminal = stream.isTTY === true && env.TERM !== "dumb";
  const locale = env.LC_ALL || env.LC_CTYPE || env.LANG;
  return {
    colors:
      terminal &&
      env.NO_COLOR === undefined &&
      env.FORCE_COLOR !== "0" &&
      (stream.hasColors?.() ?? false),
    unicode:
      terminal &&
      (platform === "win32"
        ? Boolean(env.WT_SESSION || env.TERM_PROGRAM === "vscode" || env.ConEmuANSI === "ON")
        : locale !== "C" && locale !== "POSIX"),
  };
};

export const formatFeedback = (
  message: string,
  nextStep: string | undefined,
  severity: "error" | "warning",
  style: FeedbackStyle = feedbackStyle(),
): string => {
  const paint = (code: number, text: string) =>
    style.colors ? `\u001b[${code}m${text}\u001b[0m` : text;
  const symbol = severity === "warning" ? (style.unicode ? "⚠" : "!") : style.unicode ? "✖" : "x";
  const first = paint(severity === "warning" ? 33 : 31, `${symbol} ${terminalText(message)}`);
  return nextStep
    ? `${first}\n${paint(34, `${style.unicode ? "→" : "->"} ${terminalText(nextStep)}`)}`
    : first;
};
