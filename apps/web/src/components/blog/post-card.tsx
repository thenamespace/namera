import { Link } from "@tanstack/react-router";

import { formatBlogDate } from "#/lib/blog/catalog";
import type { BlogPost } from "#/lib/blog/schema";

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="flex min-w-0 flex-col">
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        className="group block flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-focus"
      >
        {post.cover ? (
          <img
            src={post.cover.src}
            alt={post.cover.alt}
            width={post.cover.width}
            height={post.cover.height}
            loading="lazy"
            className="mb-6 aspect-[1200/630] w-full rounded-lg border border-border object-cover"
          />
        ) : null}
        <h2 className="min-h-[2lh] text-lg font-medium tracking-tight text-foreground">
          {post.title}
        </h2>
        <p className="mt-3 line-clamp-2 min-h-[2lh] text-sm leading-6 text-muted">
          {post.description}
        </p>
      </Link>
      <p className="mt-6 text-xs leading-5 text-muted">
        {post.authors.map((author) => author.name).join(", ")} |{" "}
        <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
      </p>
    </article>
  );
}
