/** biome-ignore-all lint/suspicious/noExplicitAny: safe */
const keyColors = [
  "\x1b[36m", // cyan
  "\x1b[35m", // magenta
  "\x1b[34m", // blue
  "\x1b[32m", // green
  "\x1b[33m", // yellow
];

const reset = "\x1b[0m";
const bold = "\x1b[1m";

/**
 * Returns a shallow copy of an object with humanized key names.
 */
const transformKeys = (obj: Record<string, any>) => {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [formatKey(k), v]),
  );
};

/**
 * Humanizes a key by spacing words and title-casing tokens.
 */
const formatKey = (key: string) =>
  key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Formats a primitive-like value for display.
 */
const formatValue = (value: any): string => {
  if (value === null) return "null";

  if (typeof value === "bigint") {
    return `${value}n`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return String(value);
};

/**
 * Returns true when a value is a display-friendly primitive.
 */
const isPrimitive = (v: any) =>
  v === null || typeof v !== "object" || v instanceof Date;

/**
 * Determines whether an array contains only flat objects of primitives.
 */
const isFlatObjectArray = (arr: Record<string, any>[]) =>
  arr.length > 0 &&
  arr.every(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      Object.values(item).every(isPrimitive),
  );

/**
 * Formats objects or arrays into a human-friendly CLI display string.
 *
 * Uses colorized keys when printing objects, and falls back to tabular
 * output for flat object arrays at the root level.
 */
export const prettyFormat = (
  input: Record<string, any> | Record<string, any>[],
  depth = 0,
  isRoot = true,
): string => {
  const colors = true;
  const indent = 2;
  const maxDepth = 6;
  const space = " ".repeat(indent * depth);

  if (depth > maxDepth) return `${space}…`;

  if (isRoot && Array.isArray(input) && isFlatObjectArray(input)) {
    const transformed = input.map(transformKeys);
    console.table(transformed);
    return "";
  }

  // Array
  if (Array.isArray(input)) {
    return input
      .map((item, i) => {
        if (isPrimitive(item)) {
          return `${space}${formatValue(item)}`;
        }

        return `${space}[${i}]\n${prettyFormat(item, depth + 1, false)}`;
      })
      .join("\n");
  }

  // Object
  return Object.entries(input)
    .map(([key, value]) => {
      const color = keyColors[depth % keyColors.length];
      const k = colors
        ? `${bold}${color}${formatKey(key)}${reset}`
        : formatKey(key);

      if (isPrimitive(value)) {
        return `${space}${k}: ${formatValue(value)}`;
      }

      return `${space}${k}:\n${prettyFormat(value, depth + 1, false)}`;
    })
    .join("\n");
};
