import { Schema } from "effect";

import type { BlogCardProps } from "@/types";

export const BlogSearchParams = Schema.toStandardSchemaV1(
  Schema.Struct({
    from: Schema.optional(Schema.String),
    limit: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
    page: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
    query: Schema.optional(Schema.String),
    to: Schema.optional(Schema.String),
  }),
);

export type BlogSearchParams = typeof BlogSearchParams.Type;

const applyFilters = (
  data: BlogCardProps[],
  filters: BlogSearchParams,
): BlogCardProps[] => {
  return data.filter((item) => {
    if (filters.query) {
      const q = filters.query.toLowerCase().trim();
      if (!item.title.toLowerCase().includes(q)) return false;
    }

    if (filters.from && item.datePublished < new Date(filters.from))
      return false;

    if (filters.to && item.datePublished > new Date(filters.to)) return false;

    return true;
  });
};

export const getPaginatedBlogs = (
  allPages: BlogCardProps[],
  filters: BlogSearchParams,
) => {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 3;
  const data = applyFilters(allPages, filters);

  data.sort((a, b) => b.datePublished.getTime() - a.datePublished.getTime());

  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = totalPages > page;
  const hasPrevPage = page > 1;

  const start = (page - 1) * limit;
  const end = start + limit;

  const items = data.slice(start, end);

  return {
    currentPage: page,
    hasNextPage,
    hasPrevPage,
    items,
    total,
    totalPages,
  };
};

export const getPaginationRange = ({
  currentPage,
  totalPages,
  siblingCount = 1,
}: {
  currentPage: number;
  totalPages: number;
  siblingCount?: number;
}) => {
  const totalNumbers = siblingCount * 2 + 5;

  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const left = Math.max(currentPage - siblingCount, 1);
  const right = Math.min(currentPage + siblingCount, totalPages);

  const showLeftDots = left > 2;
  const showRightDots = right < totalPages - 1;

  const range: (number | "...")[] = [];

  range.push(1);

  if (showLeftDots) range.push("...");

  for (let i = left; i <= right; i++) {
    if (i !== 1 && i !== totalPages) {
      range.push(i);
    }
  }

  if (showRightDots) range.push("...");

  if (totalPages > 1) range.push(totalPages);

  return range;
};
