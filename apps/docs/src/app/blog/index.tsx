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
      return {
        author: page.data.author,
        datePublished:
          page.data.date instanceof Date
            ? page.data.date
            : new Date(page.data.date),
        description: page.data.description,
        lastModified: page.data.lastModified ?? new Date(),
        slug: page.slugs[0] ?? "",
        title: page.data.title,
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
    <div>
      <BlogHero />
      <div className="px-4 mx-auto max-w-3xl flex flex-col py-12 w-full divide-y min-h-[40dvh]">
        {data.items.map((blog) => (
          <BlogCard {...blog} key={blog.slug} />
        ))}
      </div>
      <Pagination>
        <PaginationContent className="bg-[#171824] rounded-lg px-1 py-1 mb-12">
          <PaginationItem>
            <Button
              className="hover:bg-[#1F2433] bg-[#171824]"
              disabled={data.currentPage === 1}
              onClick={() => goToPage(Math.max(1, data.currentPage - 1))}
              size="icon"
            >
              <CaretLeftIcon />
            </Button>
          </PaginationItem>
          {pages.map((page) => (
            <PaginationItem key={`page-${page.toString()}`}>
              {page === "..." ? (
                <span className="px-3 text-muted-foreground">…</span>
              ) : (
                <Button
                  className={cn(
                    "hover:bg-[#1F2433]",
                    page === data.currentPage ? "bg-[#1F2433]" : "bg-[#171824]",
                  )}
                  nativeButton={false}
                  onClick={() => goToPage(page)}
                  size="icon"
                >
                  {page}
                </Button>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <Button
              className="hover:bg-[#1F2433] bg-[#171824]"
              disabled={
                data.currentPage >= data.totalPages || data.totalPages === 0
              }
              onClick={() =>
                goToPage(Math.min(data.totalPages, data.currentPage + 1))
              }
              size="icon"
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
