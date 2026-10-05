import { createFileRoute, Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { PostCard } from "#/components/blog/post-card";
import { BlogSearch } from "#/components/blog/search-dialog";
import { BLOG_PAGE_SIZE, filterPosts } from "#/lib/blog/catalog";
import { getBlogPosts } from "#/lib/blog/queries";
import { blogFeedLink } from "#/lib/blog/seo";
import { seo } from "#/lib/seo";

const Search = Schema.Struct({
  tag: Schema.optional(Schema.String),
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
  const { tag = "", page = 1 } = Route.useSearch();
  const tags = [...new Set(posts.flatMap((post) => post.tags))].toSorted();
  const filtered = filterPosts(posts, "", tag);
  const pages = Math.max(1, Math.ceil(filtered.length / BLOG_PAGE_SIZE));
  const visible = filtered.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE);
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-10 md:py-28">
      <h1 className="text-4xl font-medium tracking-tight text-foreground md:text-5xl">Blog</h1>
      <div className="mt-8 mb-12 flex flex-wrap items-center justify-between gap-6">
        <nav aria-label="Article categories" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {["", ...tags].map((category) => (
            <Link
              key={category}
              to="/blog"
              search={{ tag: category || undefined }}
              aria-current={category === tag ? "page" : undefined}
              className={
                category === tag
                  ? "tap-target flex items-center text-foreground"
                  : "tap-target flex items-center text-muted hover:text-foreground"
              }
            >
              {category || "All"}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <BlogSearch posts={posts} />
          <a
            href="/blog/rss.xml"
            aria-label="Subscribe via RSS"
            className="tap-target flex items-center text-sm text-muted hover:text-foreground"
          >
            RSS
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
            <Link to="/blog" search={{ tag: tag || undefined, page: page - 1 }}>
              Previous
            </Link>
          ) : null}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link to="/blog" search={{ tag: tag || undefined, page: page + 1 }}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
