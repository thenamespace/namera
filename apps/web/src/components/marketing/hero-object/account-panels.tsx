import { AlchemyIcon, ChainIcon } from "@namera-ai/ui/icons";

import { ACCOUNTS, CHAIN_LABEL, EXECUTIONS } from "./data";
import { Emoji, StatusCell, Table, Td, Toolbar } from "./display";

export const AccountsPanel = () => (
  <div className="flex flex-col gap-4">
    <Toolbar placeholder="Filter accounts…" />
    <Table
      columns={[
        { label: "Name" },
        { label: "Namespace", className: "hidden sm:table-cell w-[7.5rem]" },
        { label: "Address", className: "hidden lg:table-cell" },
        { label: "Implementation", className: "hidden xl:table-cell" },
        { label: "Status", className: "w-[7rem]" },
        { label: "Created", className: "hidden sm:table-cell w-[7rem]" },
      ]}
    >
      {ACCOUNTS.map((account) => (
        <tr key={account.name}>
          <Td>
            <span className="flex items-center gap-2">
              <Emoji>{account.emoji}</Emoji>
              <span className="truncate">{account.name}</span>
            </span>
          </Td>
          <Td className="hidden sm:table-cell">
            <span className="flex items-center gap-1.5">
              <ChainIcon
                namespace="eip155"
                chain="ethereum"
                aria-hidden
                className="size-3.5 rounded-[3px]"
              />
              EVM
            </span>
          </Td>
          <Td className="type-mono hidden text-[0.6875rem] text-muted lg:table-cell">
            {account.address}
          </Td>
          <Td className="hidden xl:table-cell">
            <span className="flex items-center gap-1.5">
              <AlchemyIcon aria-hidden className="size-3.5 rounded-[3px]" />
              <span className="truncate">Alchemy Modular V2</span>
            </span>
          </Td>
          <Td>
            <StatusCell status={account.status} />
          </Td>
          <Td className="hidden text-[0.75rem] text-ink-subtle sm:table-cell">{account.created}</Td>
        </tr>
      ))}
    </Table>
  </div>
);

export const ActivityPanel = () => (
  <div className="flex flex-col gap-4">
    <Toolbar placeholder="Filter executions…" />
    <Table
      columns={[
        { label: "Wallet" },
        { label: "Chain", className: "hidden sm:table-cell w-[7rem]" },
        { label: "Session key", className: "hidden lg:table-cell" },
        { label: "Called by", className: "hidden xl:table-cell" },
        { label: "Transaction", className: "hidden lg:table-cell w-[8rem]" },
        { label: "Status", className: "w-[7rem]" },
        { label: "Executed", className: "w-[6.5rem]" },
      ]}
    >
      {EXECUTIONS.map((item, index) => (
        <tr key={`${item.tx}-${String(index)}`}>
          <Td>
            <span className="flex items-center gap-2">
              <Emoji>{item.emoji}</Emoji>
              <span className="truncate">{item.wallet}</span>
            </span>
          </Td>
          <Td className="hidden sm:table-cell">
            <span className="flex items-center gap-1.5">
              <ChainIcon
                namespace="eip155"
                chain={item.chain}
                aria-hidden
                className="size-3.5 rounded-[3px]"
              />
              {CHAIN_LABEL[item.chain]}
            </span>
          </Td>
          <Td className="hidden text-muted lg:table-cell">{item.key}</Td>
          <Td className="type-mono hidden text-[0.6875rem] text-muted xl:table-cell">
            {item.caller}
          </Td>
          <Td className="type-mono hidden text-[0.6875rem] text-muted lg:table-cell">{item.tx}</Td>
          <Td>
            <StatusCell status={item.status} />
          </Td>
          <Td className="text-[0.75rem] text-ink-subtle">{item.when}</Td>
        </tr>
      ))}
    </Table>
  </div>
);
