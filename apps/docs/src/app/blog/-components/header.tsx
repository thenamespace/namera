import type { BlogMetadata } from "@/types";

export const BlogHeader = ({
  title,
  author,
  lastModified,
  readingTime,
}: BlogMetadata) => {
  return (
    <header className="relative pt-12">
      <div className="absolute top-2/7 translate-x-1/2 right-1/2 flex flex-col gap-6 items-center w-full px-4">
        <h1 className="text-7xl heading-gradient pb-2" itemProp="headline">
          {title}
        </h1>
      </div>
      <div className="absolute bottom-10 translate-x-1/2 right-1/2 flex flex-col gap-2 items-center w-full px-4 text-base">
        <address itemProp="author" rel="author">
          {author.name}
        </address>
        <div className="flex flex-row gap-2 items-center">
          <div className="text-sm">{readingTime.text}</div>
          <div className="size-0.5 bg-foreground rounded-full" />
          <div className="text-sm">
            Published on{" "}
            <time itemProp="datePublished">
              {lastModified.toLocaleDateString("en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </div>
        </div>
      </div>
      <img
        alt="Blog Hero"
        className="w-full h-[30dvh]"
        src="/assets/crescent-bottom.png"
      />
    </header>
  );
};
