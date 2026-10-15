import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIsHydrated, useMediaQuery } from "@namera-ai/ui/hooks";
import { Icon, Loading03Icon, PlayIcon, RefreshIcon, Tick02Icon } from "@namera-ai/ui/icons";

import "@xyflow/react/dist/base.css";

import { cn } from "@namera-ai/ui/utils";
import { ReactFlow, useNodesState, type Edge, type Node } from "@xyflow/react";

import {
  ChainCard,
  IntentCard,
  PolicyCard,
  PrepareCard,
  RefusedCard,
  SignCard,
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

import { FlowContext, type Flow } from "./execution/flow-context";
import { PLACED } from "./execution/layout";
import { nodeTypes } from "./execution/nodes";
import { edgeTypes, Rail, type WireData } from "./execution/wires";

export const ExecutionPath = () => {
  const [source, setSource] = useState<SourceId>("mcp");
  const [routeId, setRouteId] = useState<RouteId>("buy");
  const [amount, setAmount] = useState(1);
  const [chain, setChain] = useState<ChainId>("ethereum");
  const [step, setStep] = useState(-1);
  const [settled, setSettled] = useState(false);
  const [run, setRun] = useState(0);
  const ready = useIsHydrated();
  const wide = useMediaQuery("(min-width: 1024px)");
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
          <SectionIntro title="The life of a transaction">
            A swap on Uniswap, from agent intent to onchain execution. See how Namera prepares,
            checks, signs, and submits every transaction.
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
