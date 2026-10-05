import { createFileRoute, Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { Icon, RssIcon } from "@namera-ai/ui/icons";

import { PostCard } from "#/components/blog/post-card";
import { BlogSearch } from "#/components/blog/search-dialog";
import { BLOG_PAGE_SIZE } from "#/lib/blog/catalog";
import { getBlogPosts } from "#/lib/blog/queries";
import { blogFeedLink } from "#/lib/blog/seo";
import { seo } from "#/lib/seo";

const Search = Schema.Struct({
  page: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
});
export const Route = createFileRoute("/blog/")({
  validateSearch: Schema.decodeUnknownSync(Search),
  loader: () => getBlogPosts(),
  head: () => {
    const head = seo({
      title: "Blog",
      description: "Product updates, engineering, and ideas for building with agent wallets.",
      path: "/blog",
    });
    return { ...head, links: [...head.links, blogFeedLink] };
  },
  component: BlogIndex,
});

function BlogIndex() {
  const posts = Route.useLoaderData();
  const { page = 1 } = Route.useSearch();
  const pages = Math.max(1, Math.ceil(posts.length / BLOG_PAGE_SIZE));
  const visible = posts.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE);
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-10 md:py-28">
      <h1 className="text-4xl font-medium tracking-tight text-foreground md:text-5xl">Blog</h1>
      <div className="mt-8 mb-12 flex flex-wrap items-center justify-end gap-6">
        <div className="flex items-center gap-4">
          <BlogSearch posts={posts} />
          <a
            href="/blog/rss.xml"
            aria-label="Subscribe via RSS"
            className="tap-target flex items-center justify-center rounded-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            <Icon icon={RssIcon} aria-hidden className="size-4" />
          </a>
        </div>
      </div>
      {visible.length ? (
        <div className="grid gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-muted">
          No articles here yet.{" "}
          <Link to="/blog" search={{}} className="text-foreground underline">
            View all articles
          </Link>
        </p>
      )}
      {pages > 1 ? (
        <nav aria-label="Blog pages" className="mt-16 flex gap-6">
          {page > 1 ? (
            <Link to="/blog" search={{ page: page - 1 }}>
              Previous
            </Link>
          ) : null}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link to="/blog" search={{ page: page + 1 }}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
