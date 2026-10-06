import type { SessionKeyResponse } from "@namera-ai/protocol/dto";

import { named } from "./document.js";
import { paint, statusText } from "./style.js";

export const expiryText = (validUntil: number, now = Date.now()): string => {
  const seconds = validUntil - now / 1000;
  if (seconds <= 0) return "Expired";
  if (seconds < 60) return "Expires in less than a minute";
  const [amount, unit] =
    seconds >= 86400
      ? [Math.ceil(seconds / 86400), "day"]
      : seconds >= 3600
        ? [Math.ceil(seconds / 3600), "hour"]
        : [Math.ceil(seconds / 60), "minute"];
  return `Expires in ${amount} ${unit}${amount === 1 ? "" : "s"}`;
};

export const sessionSummary = (
  key: Pick<SessionKeyResponse, "metadata" | "status">,
  colors: boolean,
  installations?: SessionKeyResponse["installations"],
  now = Date.now(),
): string => {
  const parts = [paint(named(key.metadata), 1, colors), statusText(key.status, colors)];
  if (key.status === "revoked" || key.status === "revoking") return parts.join(" | ");
  if (!installations) return [...parts, "Expiry unavailable"].join(" | ");
  const expiries = [
    ...new Set(
      installations
        .filter(
          (installation) => installation.status !== "revoked" && installation.status !== "revoking",
        )
        .map((installation) => installation.authorization.validUntil),
    ),
  ];
  const expiry = expiries[0];
  if (expiry === undefined) return [...parts, "No network permissions"].join(" | ");
  if (expiries.length > 1) return [...parts, "Expiry varies by network"].join(" | ");
  const label = expiryText(expiry, now);
  return [...parts, expiry * 1000 <= now ? paint(label, 31, colors) : label].join(" | ");
};
