"use client";

import * as React from "react";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { OperatorBookingRow } from "@/lib/queries/operator";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatInr, STATUS_LABELS, TRAVEL_CLASS_SHORT } from "@/lib/utils";
import { Badge } from "@/components/ui/surfaces";

const columnHelper = createColumnHelper<OperatorBookingRow>();

export function OperatorBookingsTable({ rows }: { rows: OperatorBookingRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "departureAt", desc: true },
  ]);

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("reference", {
        header: "Reference",
        cell: (info) => (
          <Link
            href={`/operator/runs/${info.row.original.runId}`}
            className="rv-mono font-semibold underline underline-offset-2"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("fromCode", {
        header: "Journey",
        cell: (info) => (
          <span>
            {info.getValue()} → {info.row.original.toCode}
            <span className="ml-1 text-[10px] text-ink-muted">
              {TRAVEL_CLASS_SHORT[info.row.original.travelClass]}
            </span>
          </span>
        ),
      }),
      columnHelper.accessor("trainCode", {
        header: "Train",
        cell: (info) => (
          <span>
            {info.getValue()}
            <span className="block text-[10px] text-ink-muted">
              {info.row.original.trainName}
            </span>
          </span>
        ),
      }),
      columnHelper.accessor("departureAt", {
        header: "Departure",
        cell: (info) => (
          <span>
            {formatDate(info.getValue())}
            <span className="block text-[10px] text-ink-muted">
              {formatTime(info.getValue())}
            </span>
          </span>
        ),
      }),
      columnHelper.accessor("passengerName", {
        header: "Passenger",
        cell: (info) => (
          <span>
            {info.getValue()}
            <span className="block text-[10px] text-ink-muted">
              {info.row.original.passengerEmail}
            </span>
          </span>
        ),
      }),
      columnHelper.accessor("seatLabels", {
        header: "Seats",
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <Badge tone={info.getValue() === "confirmed" ? "success" : "danger"}>
            {STATUS_LABELS[info.getValue()]}
          </Badge>
        ),
      }),
      columnHelper.accessor("totalFarePaise", {
        header: "Fare",
        cell: (info) => (
          <span className="rv-mono">{formatInr(info.getValue())}</span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rv-scroll rounded-small border border-line-light">
      <table className="w-full min-w-[62rem] text-left text-xs">
        <caption className="sr-only">Scoped operator booking registry</caption>
        <thead className="bg-subtle/70 text-[10px] uppercase tracking-[0.07em] text-ink-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sort = header.column.getIsSorted();
                return (
                  <th key={header.id} scope="col" className="px-3 py-2 font-semibold">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-ink"
                        aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sort === "asc" ? (
                          <ArrowUp aria-hidden="true" className="h-3 w-3" />
                        ) : sort === "desc" ? (
                          <ArrowDown aria-hidden="true" className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown aria-hidden="true" className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-line-light/70">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2.5 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
