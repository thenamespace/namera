import type { BlogMetadata } from "@/types";

export const BlogHeader = ({
  title,
  author,
  lastModified,
  readingTime,
  image,
}: BlogMetadata) => {
  return (
    <header className="pt-[15dvh] flex flex-col pb-8 px-4 gap-4">
      <h1
        className="text-4xl sm:text-5xl md:text-6xl heading-gradient text-center font-medium pb-0 mb-0 max-w-3xl mx-auto"
        itemProp="headline"
      >
        {title}
      </h1>
      {image && (
        <img
          alt={`${title} Cover`}
          className="max-w-2xl aspect-[1.9] w-full mx-auto object-cover"
          src={image}
        />
      )}
      <div className="flex flex-row gap-2 items-center text-muted-foreground mx-auto text-xs md:text-sm">
        <address itemProp="author" rel="author">
          {author.name}
        </address>
        <div className="size-0.5 bg-foreground rounded-full" />
        <div>{readingTime.text}</div>
        <div className="size-0.5 bg-foreground rounded-full" />
        <div>
          <time itemProp="datePublished">
            {lastModified.toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </div>
      </div>
    </header>
  );
};
