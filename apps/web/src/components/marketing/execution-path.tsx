import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Icon, Loading03Icon, PlayIcon, RefreshIcon, Tick02Icon } from "@namera-ai/ui/icons";

import "@xyflow/react/dist/base.css";

import { cn } from "@namera-ai/ui/utils";
import {
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
} from "@xyflow/react";

import {
  ChainCard,
  IntentCard,
  PolicyCard,
  PrepareCard,
  RefusedCard,
  SignCard,
  SourceCard,
  SubmitCard,
  SwapCard,
} from "#/components/marketing/execution/cards";
import {
  BEAT_MS,
  CHAIN_AT,
  CHAINS,
  ISSUE_AT,
  KEY,
  LAST_BEAT,
  POLICY_AT,
  POLICY_CHECKS,
  PREPARE_AT,
  PREPARE_STEPS,
  ROUTES,
  SIGN_AT,
  SUBMIT_AT,
  type CardState,
  type Cell,
  type ChainId,
  type RouteId,
  type SourceId,
} from "#/components/marketing/execution/model";
import { Container, Reveal, Section, SectionIntro } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * The run lives in one context so the node components stay thin and React
 * Flow keeps ownership of positions: the reader can drag a card anywhere and
 * the run still plays through it.
 * ---------------------------------------------------------------------- */

type Flow = {
  readonly source: SourceId;
  readonly routeId: RouteId;
  readonly amount: number;
  readonly chain: ChainId;
  readonly onSource: (value: SourceId) => void;
  readonly onRoute: (value: RouteId) => void;
  readonly onAmount: (value: number) => void;
  readonly onChain: (value: ChainId) => void;
  readonly prepareCells: readonly Cell[];
  readonly policyCells: readonly Cell[];
  readonly policyDetails: readonly string[];
  readonly capFill: number;
  readonly capOver: boolean;
  readonly intentState: CardState;
  readonly issueState: CardState;
  readonly prepareState: CardState;
  readonly policyState: CardState;
  readonly refusedState: CardState;
  readonly stateAt: (beat: number) => CardState;
  readonly refusedReason: string;
  readonly sell: "USDC" | "ETH";
  readonly buy: string;
  readonly amountValue: string;
  readonly chainLabel: string;
};

const FlowContext = createContext<Flow | null>(null);

const useFlow = () => {
  const value = useContext(FlowContext);
  if (value === null) throw new Error("execution canvas node rendered outside its provider");
  return value;
};

/* ---- ports -------------------------------------------------------------- */

const PORT = "!size-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

const In = ({ side = Position.Left }: { readonly side?: Position }) => (
  <Handle id="in" type="target" position={side} isConnectable={false} className={PORT} />
);

const Out = ({
  side = Position.Right,
  id = "out",
}: {
  readonly side?: Position;
  readonly id?: string;
}) => <Handle id={id} type="source" position={side} isConnectable={false} className={PORT} />;

/* ---- node views --------------------------------------------------------- */

/* The intent panel is where the reader sets the request. It is a control, not
 * a step in the run, so no wire leaves it. */
const IntentNode = () => {
  const flow = useFlow();
  return (
    <>
      <IntentCard
        source={flow.source}
        route={flow.routeId}
        amount={flow.amount}
        chain={flow.chain}
        state={flow.intentState}
        onSource={flow.onSource}
        onRoute={flow.onRoute}
        onAmount={flow.onAmount}
        onChain={flow.onChain}
      />
    </>
  );
};

const SourceNode = () => {
  const flow = useFlow();
  return (
    <>
      <SourceCard source={flow.source} state={flow.issueState} />
      <Out side={Position.Bottom} />
    </>
  );
};

const SwapNode = () => {
  const flow = useFlow();
  return (
    <>
      <In side={Position.Top} />
      <SwapCard
        state={flow.issueState}
        sell={flow.sell}
        buy={flow.buy}
        amount={flow.amountValue}
        chain={flow.chain}
        chainLabel={flow.chainLabel}
      />
      <Out />
    </>
  );
};

const PrepareNode = () => {
  const flow = useFlow();
  return (
    <>
      <In />
      <PrepareCard state={flow.prepareState} cells={flow.prepareCells} />
      <Out />
    </>
  );
};

const PolicyNode = () => {
  const flow = useFlow();
  return (
    <>
      <In />
      <PolicyCard
        state={flow.policyState}
        cells={flow.policyCells}
        details={flow.policyDetails}
        capFill={flow.capFill}
        capOver={flow.capOver}
      />
      <Out />
      <Out side={Position.Bottom} id="fail" />
    </>
  );
};

const RefusedNode = () => {
  const flow = useFlow();
  return (
    <>
      <In side={Position.Top} />
      <RefusedCard state={flow.refusedState} reason={flow.refusedReason} />
    </>
  );
};

const SignNode = () => {
  const flow = useFlow();
  return (
    <>
      <In />
      <SignCard state={flow.stateAt(SIGN_AT)} />
      <Out side={Position.Bottom} />
    </>
  );
};

const SendNode = () => {
  const flow = useFlow();
  return (
    <>
      <In side={Position.Top} />
      <SubmitCard state={flow.stateAt(SUBMIT_AT)} />
      <Out side={Position.Bottom} />
    </>
  );
};

const ConfirmedNode = () => {
  const flow = useFlow();
  return (
    <>
      <In side={Position.Top} />
      <ChainCard state={flow.stateAt(CHAIN_AT)} chain={flow.chain} chainLabel={flow.chainLabel} />
    </>
  );
};

const nodeTypes = {
  intent: IntentNode,
  source: SourceNode,
  swap: SwapNode,
  prepare: PrepareNode,
  policy: PolicyNode,
  refused: RefusedNode,
  sign: SignNode,
  send: SendNode,
  confirmed: ConfirmedNode,
};

/* ---- wiring ------------------------------------------------------------- */

type WireData = {
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

const edgeTypes = { wire: Wire };

/* ---- where the cards start ---------------------------------------------- */

const PLACED: readonly Node[] = [
  { id: "intent", type: "intent", position: { x: 0, y: 26 }, style: { width: 274, height: 336 } },
  { id: "source", type: "source", position: { x: 328, y: 42 }, style: { width: 186, height: 58 } },
  { id: "swap", type: "swap", position: { x: 328, y: 156 }, style: { width: 186, height: 164 } },
  {
    id: "prepare",
    type: "prepare",
    position: { x: 568, y: 78 },
    style: { width: 246, height: 182 },
  },
  { id: "policy", type: "policy", position: { x: 868, y: 4 }, style: { width: 298, height: 316 } },
  {
    id: "refused",
    type: "refused",
    position: { x: 868, y: 376 },
    style: { width: 298, height: 86 },
  },
  { id: "sign", type: "sign", position: { x: 1220, y: 20 }, style: { width: 194, height: 86 } },
  { id: "send", type: "send", position: { x: 1220, y: 140 }, style: { width: 194, height: 86 } },
  {
    id: "confirmed",
    type: "confirmed",
    position: { x: 1220, y: 260 },
    style: { width: 194, height: 116 },
  },
].map(
  (node) => Object.assign(node, { draggable: true, selectable: false, connectable: false }) as Node,
);

/* ------------------------------------------------------------------------- */

export const ExecutionPath = () => {
  const [source, setSource] = useState<SourceId>("mcp");
  const [routeId, setRouteId] = useState<RouteId>("buy");
  const [amount, setAmount] = useState(1);
  const [chain, setChain] = useState<ChainId>("ethereum");
  const [step, setStep] = useState(-1);
  const [settled, setSettled] = useState(false);
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState(false);
  const [wide, setWide] = useState(true);
  const [moved, setMoved] = useState(false);
  const frame = useRef<HTMLDivElement | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([...PLACED]);

  const route = ROUTES.find((item) => item.id === routeId) ?? ROUTES[0];
  const chainInfo = CHAINS.find((item) => item.id === chain) ?? CHAINS[0];
  const amountValue = route.amounts[amount] ?? route.amounts[0];
  const capOver = Number(amountValue) > route.cap;

  /** Rules are checked in order and stop at the first failure. */
  const failAt = capOver ? POLICY_AT : chainInfo.allowed ? null : POLICY_AT + 1;
  const lastBeat = failAt ?? LAST_BEAT;
  const running = step >= 0 && !settled;

  useEffect(() => {
    setReady(true);
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setWide(query.matches);
    };
    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (step < 0 || settled) return;
    const delay = step > lastBeat ? 700 : (BEAT_MS[step] ?? 600);
    const timer = setTimeout(() => {
      if (step > lastBeat) {
        setSettled(true);
        return;
      }
      setStep((current) => current + 1);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [step, settled, lastBeat]);

  const startRun = useCallback(() => {
    setSettled(false);
    setRun((value) => value + 1);
    setStep(0);
  }, []);

  /* It plays once when it first comes into view, then only on request. */
  useEffect(() => {
    const node = frame.current;
    if (!node || !ready) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        startRun();
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ready, startRun]);

  const rewind = useCallback(() => {
    setStep(-1);
    setSettled(false);
  }, []);

  const onSource = useCallback(
    (value: SourceId) => {
      setSource(value);
      rewind();
    },
    [rewind],
  );
  const onRoute = useCallback(
    (value: RouteId) => {
      setRouteId(value);
      rewind();
    },
    [rewind],
  );
  const onAmount = useCallback(
    (value: number) => {
      setAmount(value);
      rewind();
    },
    [rewind],
  );
  const onChain = useCallback(
    (value: ChainId) => {
      setChain(value);
      rewind();
    },
    [rewind],
  );

  const cellAt = useCallback(
    (beat: number, failing: boolean): Cell => {
      if (step < 0) return "idle";
      if (failAt !== null && beat > failAt) return settled ? "skipped" : "idle";
      if (step < beat) return "idle";
      if (step === beat && !settled) return "active";
      return failing ? "fail" : "pass";
    },
    [step, settled, failAt],
  );

  const stateAt = useCallback(
    (beat: number): CardState => {
      if (step < 0) return "idle";
      if (failAt !== null) return settled ? "skipped" : "idle";
      if (step < beat) return "idle";
      if (step === beat && !settled) return "active";
      return "done";
    },
    [step, settled, failAt],
  );

  const flow = useMemo<Flow>(() => {
    const prepareCells = PREPARE_STEPS.map((_, index) => cellAt(PREPARE_AT + index, false));
    const policyCells = POLICY_CHECKS.map((_, index) =>
      cellAt(POLICY_AT + index, failAt === POLICY_AT + index),
    );
    const policyDetails = POLICY_CHECKS.map((check, index) =>
      index === 0
        ? `${amountValue} of ${String(route.cap)} ${route.sell}`
        : index === 1
          ? chainInfo.allowed
            ? KEY.networks
            : `${chainInfo.label} is not on the list`
          : check.detail,
    );

    return {
      source,
      routeId,
      amount,
      chain,
      onSource,
      onRoute,
      onAmount,
      onChain,
      prepareCells,
      policyCells,
      policyDetails,
      capFill: Number(amountValue) / route.cap,
      capOver,
      intentState: step < 0 ? "idle" : "done",
      issueState: step < 0 ? "idle" : step === ISSUE_AT && !settled ? "active" : "done",
      prepareState: step < PREPARE_AT || step < 0 ? "idle" : step < POLICY_AT ? "active" : "done",
      policyState:
        step < POLICY_AT
          ? "idle"
          : failAt !== null && step >= failAt
            ? "failed"
            : step < SIGN_AT
              ? "active"
              : "done",
      refusedState:
        step < 0 ? "idle" : failAt === null ? "skipped" : step > failAt ? "failed" : "idle",
      stateAt,
      refusedReason:
        failAt === null
          ? "nothing here broke a rule"
          : capOver
            ? `${amountValue} ${route.sell} is over the ${String(route.cap)} ${route.sell} cap`
            : `this key cannot touch ${chainInfo.label}`,
      sell: route.sell,
      buy: route.sell === "USDC" ? "ETH" : "USDC",
      amountValue,
      chainLabel: chainInfo.label,
    };
  }, [
    source,
    routeId,
    amount,
    chain,
    step,
    settled,
    failAt,
    route,
    chainInfo,
    amountValue,
    capOver,
    cellAt,
    stateAt,
    onSource,
    onRoute,
    onAmount,
    onChain,
  ]);

  const edges = useMemo<Edge[]>(() => {
    const wire = (id: string, from: [string, string], to: string, data: WireData): Edge => ({
      id,
      type: "wire",
      source: from[0],
      sourceHandle: from[1],
      target: to,
      targetHandle: "in",
      data,
    });

    const issued = step >= ISSUE_AT && step >= 0;
    return [
      wire("e-source", ["source", "out"], "swap", {
        lit: issued,
        live: step === ISSUE_AT && !settled,
        run,
      }),
      wire("e-swap", ["swap", "out"], "prepare", {
        lit: step >= PREPARE_AT,
        live: step === PREPARE_AT && !settled,
        run,
      }),
      wire("e-prepare", ["prepare", "out"], "policy", {
        lit: step >= POLICY_AT,
        live: step === POLICY_AT && !settled,
        run,
      }),
      wire("e-allowed", ["policy", "out"], "sign", {
        lit: failAt === null && step >= SIGN_AT,
        live: failAt === null && step === SIGN_AT && !settled,
        run,
        label: "allowed",
      }),
      wire("e-refused", ["policy", "fail"], "refused", {
        lit: failAt !== null && step > failAt,
        live: failAt !== null && step === failAt + 1 && !settled,
        run,
        label: "refused",
        danger: true,
      }),
      wire("e-sign", ["sign", "out"], "send", {
        lit: failAt === null && step >= SUBMIT_AT,
        live: failAt === null && step === SUBMIT_AT && !settled,
        run,
      }),
      wire("e-send", ["send", "out"], "confirmed", {
        lit: failAt === null && step >= CHAIN_AT,
        live: failAt === null && step === CHAIN_AT && !settled,
        run,
      }),
    ];
  }, [step, settled, failAt, run]);

  const resetLayout = useCallback(() => {
    setNodes([...PLACED]);
    setMoved(false);
  }, [setNodes]);

  return (
    <Section id="stack" className="border-t-1 border-border">
      <Container>
        <Reveal>
          <SectionIntro title="The life of one transaction">
            A swap on Uniswap, from the agent that asks to the block that confirms. Change what the
            agent wants and run it again. This is a walkthrough, not live data.
          </SectionIntro>
        </Reveal>

        <Reveal delay={0.06} className="mt-14 md:mt-20">
          <div
            ref={frame}
            className="overflow-hidden rounded-xl border-1 border-border bg-background"
          >
            <FlowContext.Provider value={flow}>
              {/* stacked, for screens too narrow to hold a canvas */}
              <div className="flex flex-col px-4 py-8 sm:px-6 lg:hidden">
                <IntentCard
                  source={source}
                  route={routeId}
                  amount={amount}
                  chain={chain}
                  state={flow.intentState}
                  onSource={onSource}
                  onRoute={onRoute}
                  onAmount={onAmount}
                  onChain={onChain}
                />
                <Rail lit={step >= 0} />
                <SwapCard
                  state={flow.issueState}
                  sell={flow.sell}
                  buy={flow.buy}
                  amount={flow.amountValue}
                  chain={chain}
                  chainLabel={flow.chainLabel}
                />
                <Rail lit={step >= PREPARE_AT} />
                <PrepareCard state={flow.prepareState} cells={flow.prepareCells} />
                <Rail lit={step >= POLICY_AT} />
                <PolicyCard
                  state={flow.policyState}
                  cells={flow.policyCells}
                  details={flow.policyDetails}
                  capFill={flow.capFill}
                  capOver={flow.capOver}
                />
                {failAt === null ? (
                  <>
                    <Rail lit={step >= SIGN_AT} label="allowed" />
                    <SignCard state={stateAt(SIGN_AT)} />
                    <Rail lit={step >= SUBMIT_AT} />
                    <SubmitCard state={stateAt(SUBMIT_AT)} />
                    <Rail lit={step >= CHAIN_AT} />
                    <ChainCard
                      state={stateAt(CHAIN_AT)}
                      chain={chain}
                      chainLabel={flow.chainLabel}
                    />
                  </>
                ) : (
                  <>
                    <Rail lit={step > failAt} label="refused" danger />
                    <RefusedCard state={flow.refusedState} reason={flow.refusedReason} />
                  </>
                )}
              </div>

              {/* the canvas */}
              <div className="ep-canvas hidden w-full px-4 py-8 lg:block lg:aspect-[27/10] lg:max-h-[34rem]">
                {ready && wide ? (
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={(changes) => {
                      if (changes.some((change) => change.type === "position")) setMoved(true);
                      onNodesChange(changes);
                    }}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    colorMode="dark"
                    fitView
                    fitViewOptions={{ padding: 0.03, minZoom: 0.4, maxZoom: 1 }}
                    minZoom={0.4}
                    maxZoom={1.4}
                    nodesConnectable={false}
                    nodesFocusable={false}
                    edgesFocusable={false}
                    elementsSelectable={false}
                    panOnDrag
                    panOnScroll={false}
                    zoomOnScroll={false}
                    zoomOnPinch={false}
                    zoomOnDoubleClick={false}
                    preventScrolling={false}
                    proOptions={{ hideAttribution: true }}
                  />
                ) : null}
              </div>
            </FlowContext.Provider>

            {/* run, and what came of it */}
            <div className="flex flex-col gap-4 border-t-1 border-border px-5 py-5 sm:flex-row sm:items-center sm:px-8">
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={running}
                  onClick={startRun}
                  className={
                    cn(
                      "tap-target inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5",
                      "text-[0.875rem] font-medium transition-colors duration-150 ease-out-quad",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
                      running
                        ? "bg-default/70 text-muted"
                        : "bg-accent text-white hover:bg-accent/85",
                    ) ?? ""
                  }
                >
                  <Icon
                    icon={running ? Loading03Icon : PlayIcon}
                    aria-hidden
                    strokeWidth={2}
                    className={cn("size-4", running && "animate-spin")}
                  />
                  {running ? "Running" : settled ? "Run again" : "Run"}
                </button>

                {moved ? (
                  <button
                    type="button"
                    onClick={resetLayout}
                    className={
                      cn(
                        "tap-target hidden items-center gap-1.5 rounded-lg border-1 border-border px-3 py-2.5 lg:inline-flex",
                        "text-[0.8125rem] text-muted transition-colors duration-150 ease-out-quad",
                        "hover:bg-default/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
                      ) ?? ""
                    }
                  >
                    <Icon icon={RefreshIcon} aria-hidden strokeWidth={1.8} className="size-3.5" />
                    Reset layout
                  </button>
                ) : null}
              </div>

              <output className="block min-w-0 text-[0.8125rem]">
                {running ? (
                  <span className="text-ink-subtle">
                    {step < PREPARE_AT
                      ? "Sending the request…"
                      : step < POLICY_AT
                        ? "Getting the swap ready…"
                        : step < SIGN_AT
                          ? "Checking it against your rules…"
                          : "Signing and sending…"}
                  </span>
                ) : settled && failAt !== null ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                    <span className="text-danger">Refused.</span>
                    {flow.refusedReason}. Nothing was signed and no gas was spent.
                  </span>
                ) : settled ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                    <span className="flex items-center gap-1.5 text-success">
                      <Icon icon={Tick02Icon} aria-hidden strokeWidth={2.4} className="size-3.5" />
                      Confirmed on {chainInfo.label}
                    </span>
                    <span className="text-ink-subtle">
                      {amountValue} {route.sell} swapped, no gas paid
                    </span>
                  </span>
                ) : (
                  <span className="text-ink-subtle">
                    Set what the agent wants, then run it. Cards can be dragged.
                  </span>
                )}
              </output>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
};

/** The stacked view's connector: the same dotted wire, drawn vertically. */
const Rail = ({
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
