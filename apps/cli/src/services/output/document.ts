import { stripVTControlCharacters } from "node:util";

import { DateTime, Predicate } from "effect";

import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  sepolia,
} from "viem/chains";

export type PrettyPrinter<A> = (value: A, colors: boolean) => string;
export type Field = readonly [label: string, value: unknown];

const networks = [
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  sepolia,
];
export const network = (chainId: string): string => {
  const chain = networks.find((entry) => `eip155:${entry.id}` === chainId);
  return chain ? `${chain.name} (${chainId})` : chainId;
};

// API metadata must not be able to clear the terminal or inject OSC hyperlinks.
export const terminalText = (value: string): string =>
  stripVTControlCharacters(value).replace(
    // oxlint-disable-next-line no-control-regex -- Neutralize terminal control characters in API metadata.
    /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    " ",
  );

export const heading = (value: string, colors: boolean): string =>
  colors ? `\u001b[1m${terminalText(value)}\u001b[0m` : terminalText(value);

export const humanize = (value: string): string => {
  const words = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
  return (words.charAt(0).toUpperCase() + words.slice(1))
    .replace(/\bId\b/g, "ID")
    .replace(/\bApi\b/g, "API");
};

export const date = (value: DateTime.DateTime): string =>
  `${DateTime.format(value, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
    locale: "en-GB",
  })} UTC`;

export const timestamp = (seconds: number): string => date(DateTime.makeUnsafe(seconds * 1000));

const scalar = (value: unknown): string => {
  if (value === null || value === undefined) return "None";
  if (DateTime.isDateTime(value)) return date(value);
  if (Predicate.isDate(value)) return date(DateTime.makeUnsafe(value));
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return terminalText(String(value));
};

const nested = (value: unknown): boolean =>
  Predicate.isObject(value) && !DateTime.isDateTime(value) && !Predicate.isDate(value);

export const fields = (entries: readonly Field[], colors: boolean, indent = 2): string =>
  entries
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => {
      const prefix = " ".repeat(indent) + heading(label + ":", colors);
      if (Array.isArray(value)) {
        if (!value.length) return `${prefix} None`;
        if (value.every((entry) => !nested(entry)))
          return `${prefix} ${value.map(scalar).join(", ")}`;
        return `${prefix}\n${value
          .map((entry, index) => fields([[String(index + 1), entry]], colors, indent + 2))
          .join("\n")}`;
      }
      if (nested(value))
        return `${prefix}\n${fields(
          Object.entries(value as object).map(([key, entry]) => [humanize(key), entry]),
          colors,
          indent + 2,
        )}`;
      return `${prefix} ${scalar(value)}`;
    })
    .join("\n");

export const section = (title: string, entries: readonly Field[], colors: boolean): string =>
  `${heading(title, colors)}\n${fields(entries, colors)}`;

export const collection = <A>(
  values: readonly A[],
  singular: string,
  plural: string,
  render: PrettyPrinter<A>,
  colors: boolean,
): string =>
  values.length === 0
    ? `No ${plural} found.`
    : `${heading(`Found ${values.length} ${values.length === 1 ? singular : plural}:`, colors)}\n\n${values.map((value) => render(value, colors)).join("\n\n")}`;

export const named = (metadata: {
  readonly name: string;
  readonly logo?: { readonly type: string; readonly value: string } | null;
}): string =>
  metadata.logo?.type === "emoji" ? `${metadata.logo.value} ${metadata.name}` : metadata.name;

export const recordView =
  (title: string): PrettyPrinter<object> =>
  (value, colors) =>
    section(
      title,
      Object.entries(value).map(([key, entry]) => [humanize(key), entry]),
      colors,
    );
