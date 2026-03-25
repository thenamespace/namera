import { Link } from "@tanstack/react-router";

type BlogCardProps = {
  title: string;
  description?: string;
  author: string;
  datePublished: Date;
  lastModified: Date;
  slug: string;
};

export const BlogCard = (props: BlogCardProps) => {
  return (
    <div className="py-3">
      <Link
        className="hover:bg-muted transition-all p-4 rounded-xl gap-3 flex flex-col"
        params={{ slug: props.slug }}
        to="/blog/$slug"
      >
        <h2 className="text-lg font-medium">{props.title}</h2>
        <p className="text-sm text-muted-foreground">{props.description}</p>
        <div className="flex flex-row gap-2 items-center text-xs">
          <div className="text-primary">{props.author}</div>
          <div className="size-0.5 rounded-full bg-muted-foreground" />
          <div className="text-muted-foreground">
            Updated on{" "}
            {props.lastModified.toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </Link>
    </div>
  );
};
