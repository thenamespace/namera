import { useEffect, useId, useRef, useState } from "react";

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Scrollable diagrams must be keyboard-scrollable. */
import { Button } from "@namera-ai/ui";
import { Icon, RefreshIcon } from "@namera-ai/ui/icons";

import { doLayout, parse } from "./sequence-layout";
import { render } from "./sequence-svg";
import { sequenceTheme } from "./theme";

// Adapted from the supplied renderer. React owns the controls; this isolated
// SVG subtree owns its animation and is replaced only when the chart changes.
export function SequenceDiagram({
  chart,
  title = "Sequence diagram",
}: {
  chart: string;
  title?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const host = useRef<HTMLElement>(null);
  const replay = useRef<() => void>(() => {});
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const animations: Animation[] = [];
    const stop = () => {
      for (const animation of animations) animation.cancel();
      animations.length = 0;
    };
    let observer: IntersectionObserver | undefined;
    try {
      element.innerHTML = render(doLayout(parse(chart)), sequenceTheme, id);
      const svg = element.querySelector("svg");
      if (!svg) throw new Error("Missing sequence SVG");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", title);
      svg.style.cssText = "display:block;width:100%;height:auto;min-width:640px";
      const steps = Array.from(
        svg.querySelectorAll<SVGElement>(
          "[data-step],[data-step-arrow],[data-step-label],[data-step-note]",
        ),
      );
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const play = () => {
        stop();
        if (motion.matches) return;
        for (const step of steps) {
          const index = Number(
            step.dataset.step ??
              step.dataset.stepArrow ??
              step.dataset.stepLabel ??
              step.dataset.stepNote,
          );
          const frames: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
          // Animate solid strokes without replacing the dashed response pattern.
          if (
            step instanceof SVGGeometryElement &&
            step.hasAttribute("data-step") &&
            !step.hasAttribute("stroke-dasharray")
          ) {
            const length = step.getTotalLength();
            frames[0] = {
              opacity: 0,
              strokeDasharray: String(length),
              strokeDashoffset: String(length),
            };
            frames[1] = { opacity: 1, strokeDasharray: String(length), strokeDashoffset: "0" };
          }
          animations.push(
            step.animate(frames, {
              duration: 600,
              delay: index * 650,
              fill: "backwards",
              easing: "ease-out",
            }),
          );
        }
      };
      replay.current = () => {
        observer?.disconnect();
        play();
      };
      motion.addEventListener("change", stop);
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            observer?.disconnect();
            play();
          }
        },
        { threshold: 0.15 },
      );
      observer.observe(element);
      return () => {
        stop();
        observer?.disconnect();
        motion.removeEventListener("change", stop);
        element.replaceChildren();
      };
    } catch {
      // Keep the source readable if an authored diagram cannot be rendered.
      queueMicrotask(() => setError(true));
      return () => {
        stop();
        observer?.disconnect();
        element.replaceChildren();
      };
    }
  }, [chart, id, title]);

  return (
    <figure className="relative my-10 pt-12">
      <figcaption className="sr-only">{title}</figcaption>
      <section ref={host} className="overflow-x-auto" tabIndex={0} aria-label={title} />
      {error ? (
        <div>
          <output className="text-muted">Diagram unavailable.</output>
          <pre className="mt-3 overflow-x-auto whitespace-pre text-sm text-muted">{chart}</pre>
        </div>
      ) : (
        <Button
          isIconOnly
          variant="ghost"
          aria-label="Replay sequence diagram"
          className="absolute top-0 right-0 size-11"
          onPress={() => replay.current()}
        >
          <Icon icon={RefreshIcon} aria-hidden className="size-4" />
        </Button>
      )}
    </figure>
  );
}
