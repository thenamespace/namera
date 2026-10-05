import { useDeferredValue, useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Button, Command } from "@namera-ai/ui";
import { Icon, Search01Icon } from "@namera-ai/ui/icons";

import { filterPosts } from "#/lib/blog/catalog";
import type { BlogPost } from "#/lib/blog/schema";

export function BlogSearch({ posts }: { posts: readonly BlogPost[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = filterPosts(posts, useDeferredValue(query));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return (
    <>
      <Button variant="tertiary" onPress={() => setOpen(true)} className="min-w-40 justify-start">
        <Icon icon={Search01Icon} aria-hidden className="size-4" />
        Search articles…
      </Button>
      <Command>
        <Command.Backdrop isOpen={open} onOpenChange={setOpen}>
          <Command.Container size="lg">
            <Command.Dialog
              aria-label="Search the blog"
              className="landing-home max-w-3xl bg-surface text-foreground"
              inputValue={query}
              onInputChange={setQuery}
              filter={() => true}
            >
              <Command.InputGroup aria-label="Search articles">
                <Command.InputGroup.Prefix>
                  <Icon icon={Search01Icon} aria-hidden />
                </Command.InputGroup.Prefix>
                <Command.InputGroup.Input placeholder="Search articles…" />
                <Command.InputGroup.ClearButton aria-label="Clear search" />
              </Command.InputGroup>
              <Command.List
                aria-label="Articles"
                items={results}
                renderEmptyState={() => "No articles match. Try a different phrase."}
                onAction={(slug) => {
                  setOpen(false);
                  void navigate({ to: "/blog/$slug", params: { slug: String(slug) } });
                }}
              >
                {(post) => (
                  <Command.Item id={post.slug} textValue={post.title} className="gap-4 p-3">
                    {post.cover ? (
                      <img
                        src={post.cover.src}
                        alt=""
                        width={post.cover.width}
                        height={post.cover.height}
                        className="aspect-video w-20 shrink-0 rounded-md object-cover sm:w-32"
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{post.title}</span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted sm:text-sm">
                        {post.description}
                      </span>
                    </span>
                  </Command.Item>
                )}
              </Command.List>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
    </>
  );
}
