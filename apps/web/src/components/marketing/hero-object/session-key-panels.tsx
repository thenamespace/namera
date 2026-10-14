import { ChainIcon, CheckmarkCircle02Icon, Icon } from "@namera-ai/ui/icons";

import { KEY_USAGE } from "./data";
import { Emoji, Meter, Row, StatusCell, Table, Td } from "./display";

const KeyHeader = () => (
  <div className="flex items-start gap-3 pr-10">
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#3a2a52] text-[1rem]"
    >
      🦄
    </span>
    <div className="min-w-0 pt-0.5">
      <h2 className="text-[1.125rem] font-medium tracking-[-0.015em] text-foreground">
        Uniswap Agent
      </h2>
      <p className="mt-1 text-[0.75rem] text-ink-subtle">
        Session key which has allowance to spend maximum of $100 USDC
      </p>
    </div>
  </div>
);

export const OverviewPanel = () => (
  <>
    <KeyHeader />
    <p className="mt-7 text-[0.75rem] text-ink-subtle">Properties</p>
    <dl className="mt-2 flex flex-col">
      <Row label="Status">
        <Icon
          icon={CheckmarkCircle02Icon}
          aria-hidden
          strokeWidth={1.8}
          className="size-3.5 text-success"
        />
        Active
      </Row>
      <Row label="Account">
        <Emoji>😀</Emoji> Trading Account
      </Row>
      <Row label="Namespace">
        <ChainIcon
          namespace="eip155"
          chain="ethereum"
          aria-hidden
          className="size-3.5 rounded-[3px]"
        />
        EVM
      </Row>
      <Row label="Session key ID">
        <span className="type-mono truncate text-[0.6875rem] text-muted">
          01a08832-f20e-7618-83ac
        </span>
      </Row>
      <Row label="Created">10 Sept 2026</Row>
    </dl>
  </>
);

export const PoliciesPanel = () => (
  <>
    <KeyHeader />
    <p className="mt-7 text-[0.75rem] text-ink-subtle">Networks and lifetime</p>
    <dl className="mt-2 flex flex-col">
      <Row label="Networks">
        <ChainIcon
          namespace="eip155"
          chain="ethereum"
          aria-hidden
          className="size-3.5 rounded-[3px]"
        />
        Ethereum
      </Row>
      <Row label="Expires at">27 Sept 2026</Row>
      <Row label="Signatures">
        <span className="text-muted">Messages and typed data allowed</span>
      </Row>
    </dl>

    <p className="mt-7 text-[0.75rem] text-ink-subtle">Onchain permissions</p>
    <div className="mt-2 rounded-lg border-1 border-border bg-surface/50 px-3.5 py-3">
      <p className="text-[0.8125rem] font-medium text-foreground">Token spend limit</p>
      <p className="type-mono mt-1 truncate text-[0.6875rem] text-ink-subtle">
        0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
      </p>
      <p className="mt-1.5 text-[0.75rem] text-muted">100 USDC per network</p>
    </div>
  </>
);

export const UsagePanel = () => (
  <>
    <KeyHeader />

    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      <Meter label="Token spend" used="62 USDC" of="100 USDC" fill={62} />
      <Meter label="Gas" used="0.004 ETH" of="0.05 ETH" fill={8} />
    </div>

    <p className="mt-7 text-[0.75rem] text-ink-subtle">Executions</p>
    <div className="mt-2">
      <Table
        columns={[
          { label: "Operation" },
          { label: "Amount", className: "hidden sm:table-cell w-[7rem]" },
          { label: "Status", className: "w-[7rem]" },
          { label: "Executed", className: "hidden sm:table-cell w-[6.5rem]" },
        ]}
      >
        {KEY_USAGE.map((item) => (
          <tr key={item.what}>
            <Td>{item.what}</Td>
            <Td className="hidden tabular-nums text-muted sm:table-cell">{item.amount}</Td>
            <Td>
              <StatusCell status={item.status} />
            </Td>
            <Td className="hidden text-[0.75rem] text-ink-subtle sm:table-cell">{item.when}</Td>
          </tr>
        ))}
      </Table>
    </div>
    <p className="mt-3 text-[0.6875rem] text-ink-subtle">
      120 USDC was refused: it would have taken the period past 100.
    </p>
  </>
);
