// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { recipes } from "@namera-ai/recipes";
import { Chip, IconPreview, Input, Typography } from "@namera-ai/ui";
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
          Recipes
        </HeadingGroup.Title>
        <HeadingGroup.Description>
          Create a session key from a ready-to-use policy template.
        </HeadingGroup.Description>
      </HeadingGroup>
      <Input
        aria-label="Search recipes"
        placeholder="Search recipes or tags"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        fullWidth
        variant="secondary"
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((recipe) => (
          <Link
            key={recipe.id}
            to="/recipes/$recipeId"
            params={recipe.params}
            className="group overflow-hidden rounded-xl border border-separator transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
          >
            <img
              src={recipe.display.banner}
              alt=""
              className="h-36 w-full bg-surface object-cover"
              loading="lazy"
            />
            <div className="grid gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <IconPreview value={recipe.display.logo} size="lg" />
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-muted" aria-hidden />
              </div>
              <div className="grid gap-2">
                <Typography.Heading level={2} className="text-base">
                  {recipe.display.name}
                </Typography.Heading>
                <Typography.Paragraph size="sm" color="muted">
                  {recipe.display.description}
                </Typography.Paragraph>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recipe.display.tags.map((tag) => (
                  <Chip key={tag} size="sm" variant="soft">
                    {tag}
                  </Chip>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {visible.length === 0 ? (
        <Typography.Paragraph color="muted">
          No recipes match. Try a different name or tag.
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}
