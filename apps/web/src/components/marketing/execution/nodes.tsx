import { Handle, Position } from "@xyflow/react";

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
} from "./cards";
import { useFlow } from "./flow-context";
import { CHAIN_AT, SIGN_AT, SUBMIT_AT } from "./model";

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

export const nodeTypes = {
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
