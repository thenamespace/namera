import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { blogMdxComponents } from "#/components/blog/mdx-components";
import { formatBlogDate } from "#/lib/blog/catalog";
import { getBlogPosts } from "#/lib/blog/queries";
import { articleHead } from "#/lib/blog/seo";

import collections from "../../.source/browser";

const content = collections.blog.createClientLoader({
  component: ({ default: MDX }) => <MDX components={blogMdxComponents} />,
});
export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = (await getBlogPosts()).find((article) => article.slug === params.slug);
    if (!post) throw notFound();
    await content.preload(post.path);
    return post;
  },
  head: ({ loaderData }) => (loaderData ? articleHead(loaderData) : {}),
  component: BlogArticle,
});
function BlogArticle() {
  const post = Route.useLoaderData();
  return (
    <article className="mx-auto w-full max-w-6xl px-6 pt-20 pb-28 md:px-10 md:pt-24">
      <header className="text-center">
        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap justify-center gap-3 text-sm text-muted"
        >
          <Link to="/blog">Blog</Link>
          <span aria-hidden>/</span>
          <span>{post.tags[0]}</span>
        </nav>
        <h1 className="mx-auto max-w-[24ch] text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-6xl">
          {post.title}
        </h1>
        {post.cover ? (
          <img
            src={post.cover.src}
            alt={post.cover.alt}
            width={post.cover.width}
            height={post.cover.height}
            fetchPriority="high"
            className="mt-14 aspect-video w-full rounded-lg object-cover md:mt-20"
          />
        ) : null}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted">
          {post.authors.map((author) => (
            <span key={author.name} className="inline-flex items-center gap-2">
              {author.avatar ? (
                <img
                  src={author.avatar}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 rounded-full"
                />
              ) : null}
              {author.url ? (
                <a
                  href={author.url}
                  className="hover:text-foreground underline-offset-4 hover:underline"
                >
                  {author.name}
                </a>
              ) : (
                author.name
              )}
            </span>
          ))}
          <span aria-hidden>·</span>
          <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
          <span aria-hidden>·</span>
          <span>{post.readingMinutes} min read</span>
        </div>
        {post.updated ? (
          <p className="mt-3 text-sm text-muted">
            Updated <time dateTime={post.updated}>{formatBlogDate(post.updated)}</time>
          </p>
        ) : null}
      </header>
      <div className="mx-auto mt-14 max-w-[44rem] md:mt-20">{content.useContent(post.path)}</div>
      <footer className="mx-auto mt-16 max-w-[44rem] border-t border-border pt-8">
        <Link to="/blog" className="text-sm text-muted hover:text-foreground">
          ← All articles
        </Link>
      </footer>
    </article>
  );
}
