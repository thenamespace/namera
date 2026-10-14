// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { recipes } from "@namera-ai/recipes";
import { Chip, Input, Typography } from "@namera-ai/ui";
import { ArrowRight01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { HeadingGroup } from "@/components/heading-group";

const recipeCards = recipes.map((recipe) => ({
  id: recipe.id,
  display: recipe.display,
  params: { recipeId: recipe.id },
}));

export function RecipeList() {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = recipeCards.filter(({ display }) =>
    [display.name, display.description, ...display.tags].some((text) =>
      text.toLowerCase().includes(query),
    ),
  );

  return (
    <div className="grid gap-6">
      <HeadingGroup>
        <HeadingGroup.Title level={1} size="lg">
          Templates
        </HeadingGroup.Title>
        <HeadingGroup.Description>
          Create a session key from a ready-to-use policy template.
        </HeadingGroup.Description>
      </HeadingGroup>
      <Input
        aria-label="Search templates"
        placeholder="Search templates or tags"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-80 max-w-full"
        variant="secondary"
      />
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {visible.map((recipe) => (
          <Link
            key={recipe.id}
            to="/recipes/$recipeId"
            params={recipe.params}
            className="group overflow-hidden rounded-xl border border-separator transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
          >
            <img
              src={`https://cdn.namera.ai/${recipe.display.banner}`}
              alt=""
              className="h-36 w-full bg-surface object-cover"
              loading="lazy"
            />
            <div className="grid gap-4 px-5 pb-5">
              <div className="flex items-center justify-between gap-3">
                <div className="relative -mt-6 rounded-full bg-background p-1">
                  <img
                    src={`https://cdn.namera.ai/${recipe.display.logo}`}
                    alt=""
                    className="size-12 rounded-full object-cover"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Typography.Heading level={2} className="text-base">
                  {recipe.display.name}
                </Typography.Heading>
                <Typography.Paragraph size="sm" color="muted" className="line-clamp-3">
                  {recipe.display.description}
                </Typography.Paragraph>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {recipe.display.tags.map((tag) => (
                    <Chip key={tag} size="sm" variant="soft">
                      {tag}
                    </Chip>
                  ))}
                </div>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-5 shrink-0 -translate-x-2 text-muted opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
                  aria-hidden
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
      {visible.length === 0 ? (
        <Typography.Paragraph color="muted">
          No templates match. Try a different name or tag.
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}
