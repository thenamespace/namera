import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { sourceBlog } from "@/lib/source";

import { BlogCard, BlogHero } from "./-components";

const serverLoader = createServerFn({
  method: "GET",
}).handler(() => {
  const pages = sourceBlog.getPages();

  const res = pages.map((page) => {
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

  return {
    contents: res,
  };
});

const BlogHomePage = () => {
  const data = useLoaderData({ from: "/blog/" });
  return (
    <div>
      <BlogHero />
      <div className="px-4 mx-auto max-w-3xl flex flex-col py-12 w-full divide-y min-h-[40dvh]">
        {data.contents.map((blog) => (
          <BlogCard {...blog} key={blog.slug} />
        ))}
      </div>
    </div>
  );
};

export const Route = createFileRoute("/blog/")({
  component: BlogHomePage,
  loader: async () => {
    const res = await serverLoader();
    return res;
  },
});
