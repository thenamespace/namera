import { useDeferredValue, useState } from "react";

import { Link } from "@tanstack/react-router";

import { Button, Modal, SearchField } from "@namera-ai/ui";

import { filterPosts } from "#/lib/blog/catalog";
import type { BlogPost } from "#/lib/blog/schema";

export function BlogSearch({ posts }: { posts: readonly BlogPost[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = filterPosts(posts, useDeferredValue(query));
  return (
    <>
      <Button variant="secondary" onPress={() => setOpen(true)} className="min-w-40 justify-start">
        Search articles…
      </Button>
      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog className="landing-home bg-surface text-foreground">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Search the blog</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <SearchField aria-label="Search articles" value={query} onChange={setQuery}>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search articles…" />
                    <SearchField.ClearButton aria-label="Clear search" />
                  </SearchField.Group>
                </SearchField>
                <output className="mt-4 text-sm text-muted">
                  {results.length} {results.length === 1 ? "article" : "articles"}
                </output>
                <ul className="mt-3 max-h-[50vh] overflow-y-auto">
                  {results.map((post) => (
                    <li key={post.slug}>
                      <Link
                        to="/blog/$slug"
                        params={{ slug: post.slug }}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg p-3 hover:bg-default focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        <span className="font-medium">{post.title}</span>
                        <p className="mt-1 text-sm text-muted">{post.description}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
                {!results.length ? (
                  <p className="py-8 text-muted">No articles match. Try a different phrase.</p>
                ) : null}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
