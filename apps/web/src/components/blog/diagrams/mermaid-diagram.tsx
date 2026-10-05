/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Scrollable diagrams must be keyboard-scrollable. */
import { useEffect, useId, useRef, useState } from "react";

export function MermaidDiagram({ chart, title = "Diagram" }: { chart: string; title?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const host = useRef<HTMLElement>(null);
  const [status, setStatus] = useState("Loading diagram…");
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    const draw = async () => {
      const { default: mermaid } = await import("mermaid");
      if (disposed) return;
      const styles = getComputedStyle(element);
      const color = (token: string) =>
        styles.getPropertyValue(`--color-${token}`).trim() ||
        styles.getPropertyValue(`--${token}`).trim();
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
          darkMode: true,
          fontFamily: "Inter, sans-serif",
          background: color("background"),
          primaryColor: color("surface"),
          primaryTextColor: color("foreground"),
          primaryBorderColor: color("muted"),
          lineColor: color("muted"),
          textColor: color("foreground"),
          secondaryColor: color("default"),
          tertiaryColor: color("surface"),
          noteBkgColor: color("surface"),
          noteTextColor: color("foreground"),
        },
        suppressErrorRendering: true,
      });
      const { svg } = await mermaid.render(`mermaid-${id}`, chart);
      if (disposed) return;
      element.innerHTML = svg;
      const rendered = element.querySelector("svg");
      rendered?.setAttribute("role", "img");
      rendered?.setAttribute("aria-label", title);
      setStatus("");
    };
    void draw().catch((error: unknown) => {
      if (!disposed)
        setStatus(
          `Diagram unavailable. ${error instanceof Error ? error.message : "Read its source below."}`,
        );
    });
    return () => {
      disposed = true;
      element.replaceChildren();
    };
  }, [chart, id, title]);
  return (
    <figure className="my-10">
      <figcaption className="sr-only">{title}</figcaption>
      {status ? <output className="text-sm text-muted">{status}</output> : null}
      <section
        ref={host}
        className="overflow-x-auto [&>svg]:mx-auto"
        tabIndex={0}
        aria-label={title}
      />
      <details className="mt-3 text-sm text-muted">
        <summary className="cursor-pointer">Diagram source</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre">{chart}</pre>
      </details>
    </figure>
  );
}
