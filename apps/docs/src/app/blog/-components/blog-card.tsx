import { Link } from "@tanstack/react-router";

import type { BlogCardProps } from "@/types";

export const BlogCard = (props: BlogCardProps) => {
  return (
    <div className="py-3">
      <Link
        className="gap-3 flex flex-col"
        params={{ slug: props.slug }}
        to="/blog/$slug"
      >
        <img
          alt={`${props.title} Cover`}
          className="w-full aspect-[1.9] border rounded-sm object-cover mb-1"
          src={props.image}
        />
        <div className="flex flex-row gap-2 items-center text-xs">
          <div className="text-muted-foreground">{props.author}</div>
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
        <h2 className="text-lg font-medium">{props.title}</h2>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </Link>
    </div>
  );
};
