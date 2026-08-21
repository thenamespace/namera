import { Base64 } from "@namera-ai/utils";

const PREFIX = "portfolio:";

export const encodePortfolioCursor = (offset: number): string =>
  Base64.encodeURI(`${PREFIX}${offset}`);

export const decodePortfolioCursor = (cursor: string | undefined): number => {
  if (cursor === undefined) return 0;
  try {
    const decoded = Base64.decode(cursor);
    if (!decoded.startsWith(PREFIX)) return 0;
    const offset = Number(decoded.slice(PREFIX.length));
    return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
};
