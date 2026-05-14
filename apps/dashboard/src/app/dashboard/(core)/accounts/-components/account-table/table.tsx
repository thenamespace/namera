import type { Address } from "viem";

import { useState } from "react";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Checkbox } from "@namera-ai/ui/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@namera-ai/ui/components/ui/table";
import { cn } from "@namera-ai/ui/lib/utils";

type Account = {
  id: string;
  address: Address;
  metadata: {
    name: string;
    icon: {
      type: "icon" | "emoji";
      value: string;
    };
    description: string;
  };
};

const accounts: Account[] = [
  {
    id: "1",
    address: "0x1234567890123456789012345678901234567890",
    metadata: {
      name: "Namera",
      icon: {
        type: "icon",
        value:
          "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKApivzcVtgFPIKXeNmJYMUTz0HpbiVLDoxQR7",
      },
      description: "Namera is a decentralized AI agent platform.",
    },
  },
];

export const columns: ColumnDef<Account>[] = [
  {
    id: "select",
    cell: ({ row }) => {
      return (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "metadata.name",
    cell: ({ row }) => {
      const data = row.original;
      return (
        <div className="flex flex-row items-center gap-2">
          <img
            src={data.metadata.icon.value}
            alt=""
            className="size-6 rounded-md"
          />
          <span>{data.metadata.name}</span>
        </div>
      );
    },
    header: "Name",
  },
  {
    accessorKey: "metadata.description",
    header: "Description",
  },
  { accessorKey: "address", header: "Address" },
  { accessorKey: "id", header: "ID" },
];

export const AccountsTable = () => {
  const [rowSelection, setRowSelection] = useState({});

  const table = useReactTable({
    data: accounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  return (
    <div className="overflow-hidden px-4">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-background!">
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id} className="px-4">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  "group hover:bg-muted/80 h-11 transition-colors",
                  row.getIsSelected()
                    ? "bg-primary/15 hover:bg-primary/15"
                    : "",
                )}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="px-4 first:rounded-l-xl last:rounded-r-xl"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
