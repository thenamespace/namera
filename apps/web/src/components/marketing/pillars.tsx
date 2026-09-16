import { cn } from "@namera-ai/ui/utils";

import { Container, Reveal, Section, SectionIntro } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * The three ideas, drawn.
 *
 * A statement in two weights — the claim in white, the reasoning in grey —
 * and then three figures that carry the argument without prose doing all the
 * work. The drawings are isometric line art: a projection, not a picture, so
 * they read as diagrams of how the product behaves rather than decoration.
 *
 * Each one says a single thing:
 *   0.1  a request that does not fit the opening does not go through
 *   0.2  every key is fenced, and the fence is drawn when it is issued
 *   0.3  the key never leaves; only the signature does
 * ---------------------------------------------------------------------- */

/* ------------------------------ isometry ---------------------------------- */

const ISO_X = Math.cos(Math.PI / 6);

type Pt = readonly [number, number, number];

/** x runs right-and-down, y left-and-down, z straight up. */
const project = ([x, y, z]: Pt) =>
  `${((x - y) * ISO_X).toFixed(1)},${((x + y) * 0.5 - z).toFixed(1)}`;

const poly = (points: readonly Pt[]) => points.map(project).join(" ");

const path = (points: readonly Pt[]) => `M${poly(points).replaceAll(" ", "L")}Z`;

/** A solid block: three faces, lit from above so it reads as an object. */
const Box = ({
  x,
  y,
  z = 0,
  w,
  d = w,
  h,
  accent = false,
}: {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly w: number;
  readonly d?: number;
  readonly h: number;
  readonly accent?: boolean;
}) => (
  <g stroke={accent ? "var(--color-accent-text)" : undefined}>
    <polygon
      points={poly([
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ])}
      fill="url(#face-left)"
    />
    <polygon
      points={poly([
        [x + w, y, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x + w, y, z + h],
      ])}
      fill="url(#face-right)"
    />
    <polygon
      points={poly([
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ])}
      fill="url(#face-top)"
    />
  </g>
);

/** A flat plate with a square opening cut through it. */
const Plate = ({
  z,
  half,
  gap,
  thickness = 4,
}: {
  readonly z: number;
  readonly half: number;
  readonly gap: number;
  readonly thickness?: number;
}) => {
  const outer: Pt[] = [
    [-half, -half, z],
    [half, -half, z],
    [half, half, z],
    [-half, half, z],
  ];
  const inner: Pt[] = [
    [-gap, -gap, z],
    [gap, -gap, z],
    [gap, gap, z],
    [-gap, gap, z],
  ];
  const t = z - thickness;

  return (
    <g>
      <path d={`${path(outer)} ${path(inner)}`} fillRule="evenodd" fill="url(#face-top)" />
      <polygon
        points={poly([
          [-half, half, t],
          [half, half, t],
          [half, half, z],
          [-half, half, z],
        ])}
        fill="url(#face-left)"
      />
      <polygon
        points={poly([
          [half, -half, t],
          [half, half, t],
          [half, half, z],
          [half, -half, z],
        ])}
        fill="url(#face-right)"
      />
      {/* the opening is cut, not printed: show its depth */}
      <g className="opacity-50">
        <polygon
          points={poly([
            [-gap, -gap, t],
            [gap, -gap, t],
            [gap, gap, t],
            [-gap, gap, t],
          ])}
        />
        <polyline
          points={poly([
            [-gap, gap, z],
            [-gap, gap, t],
          ])}
        />
        <polyline
          points={poly([
            [gap, gap, z],
            [gap, gap, t],
          ])}
        />
        <polyline
          points={poly([
            [gap, -gap, z],
            [gap, -gap, t],
          ])}
        />
      </g>
    </g>
  );
};

/* ------------------------------- figures ---------------------------------- */

const Frame = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) => (
  <svg
    viewBox="0 0 300 250"
    aria-label={label}
    className="h-auto w-full max-w-[22rem] text-[#4b4f58]"
    style={{ maskImage: "linear-gradient(to bottom,#000 62%,rgb(0 0 0/0.45) 100%)" }}
  >
    <defs>
      <linearGradient id="face-top" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor="#1e2026" />
        <stop offset="100%" stopColor="#131418" />
      </linearGradient>
      <linearGradient id="face-right" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#141519" />
        <stop offset="100%" stopColor="#0d0e11" />
      </linearGradient>
      <linearGradient id="face-left" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0f1013" />
        <stop offset="100%" stopColor="#0a0b0d" />
      </linearGradient>
    </defs>
    <g
      transform="translate(150,126) scale(1.1)"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    >
      {children}
    </g>
  </svg>
);

/**
 * 0.1 — the gates.
 *
 * Three plates, each with a narrower opening than the one above it. A request
 * only reaches the network if it fits through every one; the block that does
 * not fit stops on the first plate and never goes further.
 */
const CheckFigure = () => {
  const GATES = [
    { z: 30, half: 58, gap: 20 },
    { z: -2, half: 50, gap: 16 },
    { z: -34, half: 42, gap: 12 },
  ] as const;

  return (
    <Frame label="Three stacked plates, each with a smaller square opening than the one above. A small block falls through all three openings; a larger block rests on the top plate, stopped.">
      {/* corner posts, the way an exploded diagram carries the eye down */}
      <g className="opacity-25" strokeDasharray="1 5">
        {(
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ] as const
        ).map(([sx, sy]) => (
          <polyline
            key={`${String(sx)}${String(sy)}`}
            points={poly([
              [sx * GATES[0].half, sy * GATES[0].half, GATES[0].z],
              [sx * GATES[2].half, sy * GATES[2].half, GATES[2].z - 16],
            ])}
          />
        ))}
      </g>

      {/* bottom plate first, so the stack occludes correctly */}
      {GATES.toReversed().map((gate) => (
        <Plate key={gate.z} z={gate.z} half={gate.half} gap={gate.gap} />
      ))}

      {/* the shaft every allowed request travels */}
      <g className="opacity-40" strokeDasharray="2 4">
        <polyline
          points={poly([
            [-7, -7, 30],
            [-7, -7, -52],
          ])}
        />
        <polyline
          points={poly([
            [7, 7, 30],
            [7, 7, -52],
          ])}
        />
        <polyline
          points={poly([
            [7, -7, 30],
            [7, -7, -52],
          ])}
        />
      </g>

      {/* refused: too wide for the first opening, so it rests there */}
      <g className="opacity-65">
        <polygon
          points={poly([
            [16, -46, 30],
            [44, -46, 30],
            [44, -18, 30],
            [16, -18, 30],
          ])}
          strokeDasharray="2 4"
        />
        <Box x={16} y={-46} z={30} w={28} h={24} />
      </g>

      {/* allowed: sized to fit all three, on its way through */}
      <Box x={-7} y={-7} z={54} w={14} h={14} accent />
    </Frame>
  );
};

/**
 * 0.2 — the fences.
 *
 * One account in the middle and six keys around it, each standing inside a
 * boundary drawn at the moment it was issued. The boundaries are different
 * sizes because the keys are: that is the whole point of scoping them.
 */
const ScopeFigure = () => {
  const KEYS = [
    { x: -84, y: -6, s: 15, pad: 9, live: true },
    { x: -30, y: -78, s: 13, pad: 16, live: false },
    { x: 40, y: -66, s: 16, pad: 10, live: true },
    { x: 66, y: 6, s: 13, pad: 18, live: false },
    { x: 26, y: 62, s: 15, pad: 11, live: false },
    { x: -56, y: 66, s: 12, pad: 14, live: true },
  ] as const;

  const GRID = [-84, -63, -42, -21, 0, 21, 42, 63, 84];

  return (
    <Frame label="A block for the account at the centre, with six smaller blocks around it. Each stands inside its own dashed boundary, of a different size, and is tethered to the account by a thin line.">
      {/* the ground, ruled */}
      <g className="opacity-[0.18]">
        {GRID.map((g) => (
          <polyline
            key={`gx${String(g)}`}
            points={poly([
              [g, -90, 0],
              [g, 90, 0],
            ])}
          />
        ))}
        {GRID.map((g) => (
          <polyline
            key={`gy${String(g)}`}
            points={poly([
              [-90, g, 0],
              [90, g, 0],
            ])}
          />
        ))}
      </g>

      {/* fences and tethers */}
      {KEYS.map((key) => (
        <g key={`f${String(key.x)}`}>
          <polygon
            points={poly([
              [key.x - key.pad, key.y - key.pad, 0],
              [key.x + key.s + key.pad, key.y - key.pad, 0],
              [key.x + key.s + key.pad, key.y + key.s + key.pad, 0],
              [key.x - key.pad, key.y + key.s + key.pad, 0],
            ])}
            strokeDasharray="2 4"
            stroke={key.live ? "var(--color-accent-text)" : undefined}
            className={key.live ? "opacity-70" : "opacity-55"}
          />
          <polyline
            points={poly([
              [key.x + key.s / 2, key.y + key.s / 2, 1],
              [0, 0, 1],
            ])}
            className="opacity-30"
          />
        </g>
      ))}

      {/* far keys, then the account, then near keys: painter's order */}
      {KEYS.filter((k) => k.x + k.y < 0).map((key) => (
        <Box key={`b${String(key.x)}`} x={key.x} y={key.y} w={key.s} h={key.s} />
      ))}

      <g>
        <Box x={-22} y={-22} w={44} h={34} />
        {/* a little machined detail on the lid */}
        <g className="opacity-45">
          {[0, 1, 2].map((i) => (
            <polyline
              key={i}
              points={poly([
                [-14 + i * 10, -14, 34.4],
                [-14 + i * 10, 14, 34.4],
              ])}
            />
          ))}
        </g>
      </g>

      {KEYS.filter((k) => k.x + k.y >= 0).map((key) => (
        <Box key={`b${String(key.x)}`} x={key.x} y={key.y} w={key.s} h={key.s} />
      ))}
    </Frame>
  );
};

/**
 * 0.3 — the keystore.
 *
 * A sealed block ringed by boundaries you own. Signatures leave it one at a
 * time, along a single thin line; the key that made them never does.
 */
const CustodyFigure = () => {
  const RINGS = [46, 62, 78];

  return (
    <Frame label="A sealed block inside three concentric dashed boundaries, with a single thin line leaving it and ending on a small stack of flat tiles outside.">
      {/* what you own, drawn as ground you keep */}
      <g className="opacity-40" strokeDasharray="2 5">
        {RINGS.map((r) => (
          <polygon
            key={r}
            points={poly([
              [-r, -r, -30],
              [r, -r, -30],
              [r, r, -30],
              [-r, r, -30],
            ])}
          />
        ))}
      </g>

      {/* the keystore: sealed, and shown to be sealed */}
      <g>
        <Box x={-30} y={-30} z={-30} w={60} h={44} />
        <g className="opacity-35">
          {[-22, -14, -6, 2, 10, 18].map((o) => (
            <polyline
              key={o}
              points={poly([
                [o, -30, 14.4],
                [o, 30, 14.4],
              ])}
            />
          ))}
        </g>
        {/* a seam around the lid */}
        <polygon
          points={poly([
            [-24, -24, 14.4],
            [24, -24, 14.4],
            [24, 24, 14.4],
            [-24, 24, 14.4],
          ])}
          className="opacity-55"
        />
      </g>

      {/* one signature at a time, and never the key */}
      <polyline
        points={poly([
          [0, -24, 24],
          [0, -24, 46],
          [0, -84, 46],
          [0, -84, 20],
        ])}
        stroke="var(--color-accent-text)"
        className="opacity-75"
      />
      {[0, 1, 2].map((i) => (
        <Box key={i} x={-14} y={-98 + i * 3} z={i * 5} w={28} d={28} h={4} accent={i === 2} />
      ))}
    </Frame>
  );
};

/* -------------------------------------------------------------------------- */

const PILLARS = [
  {
    figure: CheckFigure,
    title: "Checked before signing",
    body: "A request that breaks a rule returns an error instead of a transaction. Nothing reaches the network and no gas is spent.",
  },
  {
    figure: ScopeFigure,
    title: "Scoped to one job",
    body: "Each key carries a spend cap, the chains it may touch and a date it stops working. It cannot reach anything you did not name.",
  },
  {
    figure: CustodyFigure,
    title: "You hold the keys",
    body: "Your account is owned by your passkey and session keys stay on the machine that uses them. Namera never holds signing material.",
  },
] as const;

export const Pillars = () => (
  <Section className="border-t-1 border-border">
    <Container>
      <Reveal>
        <SectionIntro title="Wallets built for agents, not people">
          Every agent gets its own key with a spend cap, a network list and an end date. Nothing is
          signed without checking it.
        </SectionIntro>
      </Reveal>

      <div className="mt-20 grid gap-16 md:mt-28 md:grid-cols-3 md:gap-0 lg:mt-36">
        {PILLARS.map((pillar, index) => (
          <Reveal
            key={pillar.title}
            delay={index * 0.06}
            className={
              cn(
                "flex flex-col",
                index > 0 && "md:border-l-1 md:border-border md:pl-8 lg:pl-12",
                index < PILLARS.length - 1 && "md:pr-8 lg:pr-12",
              ) ?? ""
            }
          >
            <p className="type-mono text-[0.6875rem] tracking-[0.14em] text-ink-subtle/60">
              FIG 0.{index + 1}
            </p>

            <div className="flex grow items-center justify-center py-10 md:py-12">
              <pillar.figure />
            </div>

            <h3 className="text-[0.9375rem] font-medium text-foreground">{pillar.title}</h3>
            <p className="mt-3 max-w-[34ch] text-[0.9375rem] leading-[1.6] text-muted">
              {pillar.body}
            </p>
          </Reveal>
        ))}
      </div>
    </Container>
  </Section>
);
