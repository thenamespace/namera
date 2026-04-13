import {
  createFileRoute,
  useLoaderData,
  useNavigate,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Button } from "@namera-ai/ui/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@namera-ai/ui/components/ui/pagination";
import { cn } from "@namera-ai/ui/lib/utils";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";

import {
  BlogSearchParams,
  getPaginatedBlogs,
  getPaginationRange,
} from "@/lib/blog";
import { env } from "@/lib/env";
import { sourceBlog } from "@/lib/source";
import type { BlogCardProps } from "@/types";

import { BlogCard, BlogHero } from "./-components";

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator(BlogSearchParams)
  .handler(({ data }) => {
    const pages = sourceBlog.getPages();

    const allBlogs: BlogCardProps[] = pages.map((page) => {
      const dateModified = page.data.lastModified ?? new Date();
      const datePublished =
        page.data.date instanceof Date
          ? page.data.date
          : new Date(page.data.date);

      let image: string;
      if (page.data.image) {
        image = page.data.image;
      } else {
        const ogImage = new URL("/api/og", env.baseUrl);
        ogImage.searchParams.set("description", page.data.description ?? "");
        ogImage.searchParams.set("lastUpdatedDate", dateModified.toISOString());
        ogImage.searchParams.set("paths", "Blog");
        ogImage.searchParams.set("title", page.data.title);
        image = ogImage.toString();
      }
      return {
        author: page.data.author,
        datePublished: datePublished,
        description: page.data.description,
        lastModified: dateModified,
        slug: page.slugs[0] ?? "",
        title: page.data.title,
        image: page.data.image ?? image,
      };
    });

    const res = getPaginatedBlogs(allBlogs, data);

    return res;
  });

const BlogHomePage = () => {
  const data = useLoaderData({ from: "/blog/" });
  const navigate = useNavigate();

  const goToPage = (page: number) => {
    navigate({
      to: "/blog",
      replace: true,
      search: (prev) => ({
        ...prev,
        page,
      }),
    });
  };

  const pages = getPaginationRange({
    currentPage: data.currentPage,
    totalPages: data.totalPages,
  });

  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-[10dvh]">
      <BlogHero />
      <div className="min-h-[40dvh] grid grid-cols-1 sm:grid-cols-2 py-12 gap-12">
        {data.items.map((blog) => (
          <BlogCard {...blog} key={blog.slug} />
        ))}
      </div>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Button
              disabled={data.currentPage === 1}
              onClick={() => goToPage(Math.max(1, data.currentPage - 1))}
              size="icon"
              variant="ghost"
            >
              <CaretLeftIcon />
            </Button>
          </PaginationItem>
          {pages.map((page, i) => (
            <PaginationItem key={`page-${page.toString()}-${i.toString()}`}>
              {page === "..." ? (
                <span className="px-3 text-muted-foreground">…</span>
              ) : (
                <Button
                  className={cn(
                    page === data.currentPage ? "bg-muted hover:bg-muted" : "",
                  )}
                  nativeButton={false}
                  onClick={() => goToPage(page)}
                  size="icon"
                  variant="ghost"
                >
                  {page}
                </Button>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <Button
              disabled={
                data.currentPage >= data.totalPages || data.totalPages === 0
              }
              onClick={() =>
                goToPage(Math.min(data.totalPages, data.currentPage + 1))
              }
              size="icon"
              variant="ghost"
            >
              <CaretRightIcon />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export const Route = createFileRoute("/blog/")({
  component: BlogHomePage,
  validateSearch: BlogSearchParams,
  loaderDeps: ({ search: searchParams }) => searchParams,
  loader: async ({ deps }) => {
    const res = await serverLoader({
      data: deps,
    });
    return res;
  },
});
