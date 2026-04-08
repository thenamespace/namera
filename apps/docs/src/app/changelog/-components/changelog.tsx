import { useRef, useState } from "react";

import { cn } from "@namera-ai/ui/lib/utils";
import { CaretDownIcon } from "@phosphor-icons/react";
import { code } from "@streamdown/code";
import { Streamdown } from "streamdown";

import type { GithubReleaseMessage } from "@/lib/github";

import { getMDXComponents } from "../../../components/mdx-components/index";

const Markdown = ({ text }: { text: string }) => {
  return (
    <Streamdown
      // @ts-expect-error safe to ignore
      components={{
        ...getMDXComponents(),
        img: (props) => (
          <img
            className="inline-block w-5 h-5 rounded-full opacity-80 mx-0.5"
            {...props}
            alt={props.alt || ""}
            style={{ maxWidth: "100%" }}
          />
        ),
      }}
      plugins={{ code }}
    >
      {text}
    </Streamdown>
  );
};

export const Changelog = (release: GithubReleaseMessage) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    if (isExpanded) {
      setIsExpanded(false);
      const group = containerRef.current?.closest(".group");
      if (group) {
        const offset = group.getBoundingClientRect().top - 40;
        window.scrollBy({ top: offset, behavior: "smooth" });
      }
    } else {
      setIsExpanded(true);
    }
  };

  return (
    <div
      className="group border-b border-dashed py-16 first:pt-8"
      key={release.tag}
    >
      <div className="flex items-baseline mb-4">
        <div className="flex items-center gap-3">
          <a
            className="text-2xl font-medium transition-colors text-accent-foreground hover:text-white"
            href={release.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {release.title || release.tag}
          </a>
        </div>
        <time className="text-xs font-mono tracking-tight text-muted-foreground shrink-0 ml-4">
          {release.date}
        </time>
      </div>

      <div ref={containerRef}>
        <div className="relative">
          <div
            className={cn(
              "max-w-3xl prose prose-p:my-0",
              release.expandable &&
                !isExpanded &&
                "max-h-100 overflow-y-hidden",
            )}
          >
            <Markdown text={release.content} />
          </div>
          {release.expandable && !isExpanded && (
            <div className="h-20 absolute inset-x-0 bottom-0 bg-linear-to-t from-background via-background/80 to-transparent pointer-events-none" />
          )}
        </div>
        {release.expandable && (
          <button
            className="inline-flex items-center gap-1.5 mt-12 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleToggle}
            type="button"
          >
            <CaretDownIcon
              className={cn(
                "size-3.5 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
            {isExpanded ? "Collapse release" : "Expand release"}
          </button>
        )}
      </div>
    </div>
  );
};
