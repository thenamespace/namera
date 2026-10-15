import { cn } from "@namera-ai/ui/utils";
import { EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";

export type WireData = {
  readonly lit: boolean;
  readonly live: boolean;
  readonly run: number;
  readonly label?: string;
  readonly danger?: boolean;
};

const Wire = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<WireData, "wire">>) => {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.42,
  });
  const lit = data?.lit ?? false;
  const live = data?.live ?? false;
  const danger = data?.danger ?? false;
  const hue = danger ? "var(--ep-stop)" : "var(--ep-live)";

  return (
    <>
      {/* the resting wire: dotted, so an unrun path reads as potential */}
      <path
        d={path}
        fill="none"
        stroke="var(--ep-wire)"
        strokeWidth={1.75}
        strokeDasharray="0.5 5"
        strokeLinecap="round"
      />
      {/* what has run stays lit, in the brand accent */}
      <path
        d={path}
        pathLength={100}
        fill="none"
        stroke={hue}
        className="ep-trail"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.14}
        strokeDasharray="100"
        style={{ strokeDashoffset: lit ? 0 : 100 }}
      />
      <path
        d={path}
        pathLength={100}
        fill="none"
        stroke={hue}
        className="ep-trail"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeDasharray="100"
        style={{ strokeDashoffset: lit ? 0 : 100 }}
      />
      <circle
        cx={sourceX}
        cy={sourceY}
        r={3}
        className="ep-dot"
        fill={lit ? hue : "var(--ep-wire)"}
      />
      <circle
        cx={targetX}
        cy={targetY}
        r={3}
        className="ep-dot"
        fill={lit ? hue : "var(--ep-wire)"}
      />
      {live ? (
        <g key={`pulse-${String(data?.run ?? 0)}`}>
          <path
            d={path}
            pathLength={100}
            fill="none"
            stroke="var(--ep-charge)"
            className="ep-pulse"
            strokeWidth={2.25}
            strokeLinecap="round"
          />
          <g className="ep-head" style={{ offsetPath: `path("${path}")` }}>
            <circle r={8} fill={hue} opacity={0.3} />
            <circle r={3} fill="var(--ep-charge)" />
          </g>
        </g>
      ) : null}
      {data?.label === undefined ? null : (
        <EdgeLabelRenderer>
          <span
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className={cn(
              "pointer-events-none absolute rounded-md border-1 bg-background px-2 py-0.5",
              "text-[0.625rem] leading-[1.4] transition-colors duration-300 ease-out-quad",
              lit
                ? danger
                  ? "border-danger/50 text-danger"
                  : "border-accent/50 text-accent-text"
                : "border-border text-ink-subtle",
            )}
          >
            {data.label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export const edgeTypes = { wire: Wire };

/** The stacked view's connector: the same dotted wire, drawn vertically. */
export const Rail = ({
  lit,
  label,
  danger,
}: {
  readonly lit: boolean;
  readonly label?: string;
  readonly danger?: boolean;
}) => (
  <div className="flex flex-col items-center py-2" aria-hidden>
    <span
      className={cn(
        "size-1.5 rounded-full transition-colors duration-300 ease-out-quad",
        lit ? (danger === true ? "bg-danger" : "bg-accent") : "bg-hairline-strong",
      )}
    />
    <span
      className={cn(
        "my-1 h-5 w-px transition-colors duration-300 ease-out-quad",
        lit
          ? danger === true
            ? "bg-danger/70"
            : "bg-accent/70"
          : "bg-[repeating-linear-gradient(to_bottom,var(--color-hairline-strong)_0_2px,transparent_2px_6px)]",
      )}
    />
    {label === undefined ? null : (
      <>
        <span
          className={cn(
            "my-1 rounded-md border-1 px-1.5 py-0.5 text-[0.625rem]",
            "transition-colors duration-300 ease-out-quad",
            lit
              ? danger === true
                ? "border-danger/45 bg-danger/12 text-danger"
                : "border-accent/45 bg-accent/12 text-accent-text"
              : "border-border text-ink-subtle",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "my-1 h-5 w-px transition-colors duration-300 ease-out-quad",
            lit
              ? danger === true
                ? "bg-danger/70"
                : "bg-accent/70"
              : "bg-[repeating-linear-gradient(to_bottom,var(--color-hairline-strong)_0_2px,transparent_2px_6px)]",
          )}
        />
      </>
    )}
    <span
      className={cn(
        "size-1.5 rounded-full transition-colors duration-300 ease-out-quad",
        lit ? (danger === true ? "bg-danger" : "bg-accent") : "bg-hairline-strong",
      )}
    />
  </div>
);
