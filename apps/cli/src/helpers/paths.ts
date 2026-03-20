/** biome-ignore-all lint/suspicious/noExplicitAny: safe */
import { Schema } from "effect";

import type { DeepPaths } from "@/types";

/**
 * Returns the value at a dot-delimited path within a nested object.
 *
 * @param obj - Object to traverse.
 * @param path - Dot-delimited lookup path.
 */
export const getSchema = <
  T extends Record<string, any>,
  P extends DeepPaths<T>,
>(
  obj: T,
  path: P,
): any => {
  return path.split(".").reduce((acc, key) => acc[key], obj);
};

/**
 * Extracts all dot-delimited paths that terminate at Effect schemas.
 *
 * @param obj - Object tree to scan.
 * @param prefix - Internal prefix used to build nested paths.
 */
export const extractPaths = <T extends Record<string, any>>(
  obj: T,
  prefix = "",
): DeepPaths<T>[] => {
  return Object.entries(obj).flatMap(([key, value]) => {
    const newPath = prefix ? `${prefix}.${key}` : key;

    if (Schema.isSchema(value)) {
      return [newPath];
    }

    if (typeof value === "object" && value !== null) {
      return extractPaths(value, newPath);
    }

    return [];
  }) as DeepPaths<T>[];
};
