import type { ReadingTimeResult } from "@/types";

export type OmitOptions = {
  wpm?: number;
};

const DEFAULT_WPM = 225;

/**
 * Calculates the estimated reading time for a given text string.
 * Accounts for MDX/HTML artifacts.
 */
export const getReadingTime = (
  content: string | undefined | null,
  options: OmitOptions = {},
): ReadingTimeResult => {
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return { minutes: 1, text: "1 min read", time: 0, words: 0 };
  }

  const wpm = options.wpm ?? DEFAULT_WPM;

  const cleanText = content
    // Remove HTML/JSX tags entirely (<Component prop="value"> -> '')
    .replace(/<\/?[^>]+(>|$)/g, "")
    // Extract text from Markdown links/images (![alt](url) -> 'alt')
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Strip Markdown formatting characters
    .replace(/[`*#_~>]+/g, "");

  const wordRegex = /\w+(?:-\w+)*|['\w]+/g;
  const wordMatches = cleanText.match(wordRegex) || [];
  const wordCount = wordMatches.length;

  const wordTime = wordCount / wpm;

  const timeMs = Math.round(wordTime * 60 * 1000);
  const roundedMinutes = Math.max(1, Math.ceil(wordTime));

  return {
    minutes: roundedMinutes,
    text: `${roundedMinutes} min read`,
    time: timeMs,
    words: wordCount,
  };
};
